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
        
        // Fetch all existing employees to map by email
        const dbEmployees = await repo.find()
        const existingEmailsMap = new Map<string, Employee>()
        for (const emp of dbEmployees) {
            existingEmailsMap.set(emp.email.toLowerCase(), emp)
        }

        const batchSize = 500
        let synced = 0

        for (let i = 0; i < employees.length; i += batchSize) {
            const batch = employees.slice(i, i + batchSize)
            
            // Resolve email duplicates for ID changes
            for (const emp of batch) {
                if (!emp.email) continue
                const emailLower = emp.email.toLowerCase()
                const existingWithEmail = existingEmailsMap.get(emailLower)
                if (existingWithEmail && existingWithEmail.id !== emp.user_id) {
                    console.log(`[Sync] Found ID change for employee email ${emp.email} (Old ID: ${existingWithEmail.id}, New ID: ${emp.user_id}). Suffixing old record.`)
                    existingWithEmail.email = `${existingWithEmail.email}_old_${existingWithEmail.id}`
                    existingWithEmail.isActive = false
                    await repo.save(existingWithEmail)
                    existingEmailsMap.delete(emailLower)
                }
            }

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

            await repo.save(entities)
            synced += entities.length
            console.log(`[Sync] Batch ${Math.floor(i / batchSize) + 1}: saved ${entities.length} employees`)
        }

        // Deactivate employees not in Nusawork response
        const nusaworkIds = new Set(employees.map(emp => emp.user_id))
        const latestDbEmployees = await repo.find()
        const missingEmployees = latestDbEmployees.filter(emp => !nusaworkIds.has(emp.id) && emp.isActive)
        if (missingEmployees.length > 0) {
            for (const emp of missingEmployees) {
                emp.isActive = false
            }
            await repo.save(missingEmployees)
            console.log(`[Sync] Marked ${missingEmployees.length} missing/resigned employees as inactive.`)
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