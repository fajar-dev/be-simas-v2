// Queue worker — unlike the other scripts here (one-shot, cron-triggered),
// this one runs continuously under a process supervisor: bun run queue:work
import "reflect-metadata"
import { AppDataSource } from "../config/database"
import { logger } from "../core/helpers/logger"
import { queueService } from "../modules/queue/queue.module"
import "../modules/queue/handlers/nusawork.handlers"

const POLL_INTERVAL_MS = 2000

let running = true
process.on("SIGTERM", () => { running = false })
process.on("SIGINT", () => { running = false })

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
    await AppDataSource.initialize()
    logger.info("Queue worker started")

    while (running) {
        let processed = false
        try {
            processed = await queueService.processNext()
        } catch (error: any) {
            logger.error("Queue worker tick failed", { error: error?.message, stack: error?.stack })
        }
        if (!processed) {
            await sleep(POLL_INTERVAL_MS)
        }
    }

    logger.info("Queue worker shutting down")
    await AppDataSource.destroy()
    process.exit(0)
}

run().catch((error) => {
    logger.error("Queue worker crashed", { error: error?.message, stack: error?.stack })
    process.exit(1)
})
