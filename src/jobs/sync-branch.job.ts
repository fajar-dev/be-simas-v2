import { AppDataSource } from "../config/database"
import { Branch } from "../modules/branch/entities/branch.entity"
import { nusaworkHelper } from "../core/helpers/nusawork"
import { logger } from "../core/helpers/logger"

async function sync() {
    try {
        logger.info("Starting branch sync from Nusawork...")
        const startTime = Date.now()

        await AppDataSource.initialize()
        logger.info("App database connected")

        const branches = await nusaworkHelper.getBranch()
        if (branches.length === 0) {
            logger.info("No branches found from Nusawork")
            await AppDataSource.destroy()
            process.exit(0)
        }

        logger.info(`Fetched ${branches.length} branches from Nusawork`)

        const repo = AppDataSource.getRepository(Branch)
        const batchSize = 500
        let synced = 0

        for (let i = 0; i < branches.length; i += batchSize) {
            const batch = branches.slice(i, i + batchSize)
            const entities = batch.map(b => {
                return repo.create({
                    id: b.id,
                    code: b.branch_id,
                    name: b.name,
                    email: b.email,
                    phone: b.branch_phone_number,
                    address: b.branch_address,
                })
            })

            await repo.upsert(entities, ["id"])
            synced += entities.length
            logger.info(`Batch ${Math.floor(i / batchSize) + 1}: upserted ${entities.length} branches`)
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        logger.info(`Completed in ${duration}s. Synced ${synced} branches.`)

        await AppDataSource.destroy()
        process.exit(0)
    } catch (error) {
        logger.error("Branch sync failed", { error: (error as any)?.message, stack: (error as any)?.stack })
        process.exit(1)
    }
}

sync()
