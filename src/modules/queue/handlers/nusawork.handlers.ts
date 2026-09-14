// Nusawork job handlers — only imported by the queue worker, not the API server.
import { queueService } from "../queue.module"
import { assetHolderService } from "../../asset-holder/asset-holder.module"
import { nusaworkHelper } from "../../../core/helpers/nusawork"
import { NotFoundException } from "../../../core/exceptions/base"
import { logger } from "../../../core/helpers/logger"
import type { AssetHolder } from "../../asset-holder/entities/asset-holder.entity"

/** Nusawork expects date fields as a full "YYYY-MM-DD HH:mm:ss" datetime, not a bare date. */
function formatNusaworkDateTime(input: string): string {
    const dateOnlyMatch = input.match(/^(\d{4}-\d{2}-\d{2})$/)
    if (dateOnlyMatch) {
        return `${dateOnlyMatch[1]} 00:00:00`
    }
    const date = new Date(input)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Finds the `id_group` of the note created at assign time by matching `id_holder`. Throws if not found yet, so the queue's retry/backoff covers Nusawork's read-side indexing lag. */
async function findNusaworkGroupId(employeeExternalId: string, holderId: number): Promise<number> {
    const groups = await nusaworkHelper.getAssetSyncGroups(employeeExternalId)
    const group = groups.find((g) => g.items?.some((item) => item.key === "id_holder" && item.input?.value === String(holderId)))
    if (!group) {
        const seenHolderIds = groups.flatMap((g) => g.items?.filter((item) => item.key === "id_holder").map((item) => item.input?.value) ?? [])
        throw new Error(`Could not find Nusawork note group for holder ${holderId} (employee ${employeeExternalId}). Seen id_holder values: [${seenHolderIds.join(", ")}]`)
    }
    return group.id_group
}

/** Returns null (not a thrown error) if the holder was deleted before the job ran. */
async function loadHolderOrSkip(holderId: number, jobType: string): Promise<AssetHolder | null> {
    try {
        const { log } = await assetHolderService.getById(holderId)
        return log
    } catch (err) {
        if (err instanceof NotFoundException) {
            logger.info(`[nusawork.handlers] Skipping ${jobType} for holder ${holderId}: record no longer exists`)
            return null
        }
        throw err
    }
}

queueService.registerHandler("nusawork.assign", async (payload) => {
    const { holderId } = payload as { holderId: number }
    const log = await loadHolderOrSkip(holderId, "nusawork.assign")
    if (!log) return
    if (log.holderKind !== "employee" || !log.employee || !log.asset) return

    await nusaworkHelper.createAssetSync({
        employee_id: log.employee.employeeId,
        fields: {
            asset_code: log.asset.code,
            asset_name: log.asset.name,
            assign_date: formatNusaworkDateTime(log.assignedDate),
            assign_note: log.assignNote || undefined,
            id_holder: log.id,
        },
    })
})

queueService.registerHandler("nusawork.return", async (payload) => {
    const { holderId } = payload as { holderId: number }
    const log = await loadHolderOrSkip(holderId, "nusawork.return")
    if (!log) return
    if (log.holderKind !== "employee" || !log.employee || !log.returnedDate) return

    const groupId = await findNusaworkGroupId(log.employee.employeeId, log.id)
    await nusaworkHelper.returnAssetSync({
        employee_id: log.employee.employeeId,
        id_group: groupId,
        fields: {
            return_date: formatNusaworkDateTime(log.returnedDate),
            return_note: log.returnNote || undefined,
        },
    })
})

queueService.registerHandler("nusawork.update", async (payload) => {
    const { holderId } = payload as { holderId: number }
    const log = await loadHolderOrSkip(holderId, "nusawork.update")
    if (!log) return
    if (log.holderKind !== "employee" || !log.employee || !log.asset) return

    const groupId = await findNusaworkGroupId(log.employee.employeeId, log.id)
    await nusaworkHelper.updateAssetSync({
        employee_id: log.employee.employeeId,
        id_group: groupId,
        fields: {
            asset_code: log.asset.code,
            asset_name: log.asset.name,
            assign_date: formatNusaworkDateTime(log.assignedDate),
            assign_note: log.assignNote || undefined,
            return_date: log.returnedDate ? formatNusaworkDateTime(log.returnedDate) : undefined,
            return_note: log.returnNote || undefined,
        },
    })
})

queueService.registerHandler("nusawork.delete", async (payload) => {
    const { holderId, employeeExternalId } = payload as { holderId: number; employeeExternalId: string }
    const groupId = await findNusaworkGroupId(employeeExternalId, holderId)
    await nusaworkHelper.deleteAssetSync({ employee_id: employeeExternalId, id_group: groupId })
})
