/**
 * Daily reminder email for asset schedules occurring today.
 *
 * Not wired to an in-process scheduler — run once a day via an external
 * scheduler (OS crontab, hosting platform's scheduled tasks, etc), e.g.:
 *   0 7 * * *  cd /path/to/be && bun run job:asset-schedule-reminder
 */
import "reflect-metadata"
import fs from "fs"
import path from "path"
import { AppDataSource } from "../config/database"
import { config } from "../config/config"
import { mail } from "../core/helpers/mail"
import { logger } from "../core/helpers/logger"
import { assetScheduleService } from "../modules/asset-schedule/asset-schedule.module"
import type { AssetSchedule } from "../modules/asset-schedule/entities/asset-schedule.entity"

const RECURRENCE_LABELS: Record<string, string> = {
    none: "One-time schedule",
    weekly: "Repeats weekly",
    monthly: "Repeats monthly",
    yearly: "Repeats yearly",
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function todayIso(): string {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function formatDisplayDate(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number)
    const date = new Date(Date.UTC(y!, m! - 1, d!))
    return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
}

/** Dedup recipients (by email) across assigned users + the schedule's creator. */
function collectRecipients(schedule: AssetSchedule): { name: string; email: string }[] {
    const byEmail = new Map<string, { name: string; email: string }>()
    for (const link of schedule.scheduleUsers || []) {
        if (link.user?.email) byEmail.set(link.user.email, { name: link.user.name, email: link.user.email })
    }
    if (schedule.createdBy?.email) {
        byEmail.set(schedule.createdBy.email, { name: schedule.createdBy.name, email: schedule.createdBy.email })
    }
    return Array.from(byEmail.values())
}

async function run() {
    logger.info("Starting daily asset-schedule reminder job...")
    const startTime = Date.now()

    await AppDataSource.initialize()
    logger.info("Database connected")

    const today = todayIso()
    const occurrences = await assetScheduleService.getCalendar(today, today)
    logger.info(`Found ${occurrences.length} occurrence(s) for ${today}`)

    const templatePath = path.join(process.cwd(), "public/templates/asset-schedule-reminder.html")
    const templateSource = fs.readFileSync(templatePath, "utf8")
    const displayDate = formatDisplayDate(today)

    let sent = 0
    let skipped = 0

    for (const { schedule } of occurrences) {
        const recipients = collectRecipients(schedule)
        if (recipients.length === 0) {
            skipped++
            continue
        }

        const assetNames = (schedule.scheduleAssets || [])
            .filter((l) => l.asset)
            .map((l) => `${escapeHtml(l.asset.name)} (${escapeHtml(l.asset.code)})`)
        const assetsHtml = assetNames.length ? assetNames.map((a) => `• ${a}`).join("<br>") : "—"

        const baseHtml = templateSource
            .replace(/{{title}}/g, escapeHtml(schedule.title))
            .replace(/{{date}}/g, displayDate)
            .replace(/{{description}}/g, escapeHtml(schedule.description || "No additional description."))
            .replace(/{{recurrenceLabel}}/g, RECURRENCE_LABELS[schedule.recurrence] || "One-time schedule")
            .replace(/{{assets}}/g, assetsHtml)
            .replace(/{{calendarLink}}/g, `${config.app.appUrl}/calendar`)

        for (const recipient of recipients) {
            try {
                const html = baseHtml.replace(/{{name}}/g, escapeHtml(recipient.name))
                await mail.sendHtml(recipient.email, `Reminder: ${schedule.title}`, html)
                sent++
            } catch (error) {
                logger.error(`Failed to email ${recipient.email} for schedule #${schedule.id}`, { error: (error as any)?.message, stack: (error as any)?.stack })
            }
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    logger.info(`Completed in ${duration}s. Sent ${sent} email(s), skipped ${skipped} schedule(s) with no recipients.`)

    await AppDataSource.destroy()
    process.exit(0)
}

run().catch((error) => {
    logger.error("Asset-schedule reminder failed", { error: (error as any)?.message, stack: (error as any)?.stack })
    process.exit(1)
})
