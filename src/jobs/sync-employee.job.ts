import { AppDataSource } from "../config/database"
import { Employee } from "../modules/employee/entities/employee.entity"
import { nusaworkHelper } from "../core/helpers/nusawork"

async function sync() {
    try {
        console.log("[Sync] Starting employee sync from Nusawork...")
        const startTime = Date.now()

        await AppDataSource.initialize()
        console.log("[Sync] App database connected")

        const employees = await nusaworkHelper.getEmployees()
        if (employees.length === 0) {
            console.log("[Sync] No employees found from Nusawork")
            await AppDataSource.destroy()
            process.exit(0)
        }

        console.log(`[Sync] Fetched ${employees.length} employees from Nusawork`)

        const repo = AppDataSource.getRepository(Employee)
        const batchSize = 500
        let synced = 0

        for (let i = 0; i < employees.length; i += batchSize) {
            const batch = employees.slice(i, i + batchSize)
            const entities = batch.map(emp => {
                return repo.create({
                    id: emp.user_id,
                    employeeId: emp.employee_id,
                    name: emp.full_name,
                    email: emp.email,
                    photo: emp.photo_profile,
                    jobPosition: emp.job_position,
                    phone: emp.whatsapp || emp.mobile_phone,
                    isActive: emp.active_status === 'Active' ? true : false,
                })
            })

            await repo.upsert(entities, ["id"])
            synced += entities.length
            console.log(`[Sync] Batch ${Math.floor(i / batchSize) + 1}: upserted ${entities.length} employees`)
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`[Sync] Completed in ${duration}s. Synced ${synced} employees.`)

        await AppDataSource.destroy()
        process.exit(0)
    } catch (error) {
        console.error("[Sync] Failed:", error)
        process.exit(1)
    }
}

sync()