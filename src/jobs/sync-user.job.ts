import { AppDataSource } from "../config/database"
import { Employee } from "../modules/employee/entities/employee.entity"
import { User } from "../modules/user/entities/user.entity"
import { nusaworkHelper } from "../core/helpers/nusawork"

const ROLE_EMPLOYEE = 2

async function sync() {
    try {
        console.log("[Sync] Starting user sync from Nusawork employees...")
        const startTime = Date.now()

        await AppDataSource.initialize()
        console.log("[Sync] Database connected")

        const employees = await nusaworkHelper.getEmployees()
        if (employees.length === 0) {
            console.log("[Sync] No employees found from Nusawork")
            await AppDataSource.destroy()
            process.exit(0)
        }

        console.log(`[Sync] Fetched ${employees.length} employees from Nusawork`)

        const employeeRepo = AppDataSource.getRepository(Employee)
        const userRepo = AppDataSource.getRepository(User)

        // Build a map of email → employee.id for linking
        const employeeMap = new Map<string, number>()
        const allEmployees = await employeeRepo.find({ select: ["id", "email"] })
        for (const emp of allEmployees) {
            if (emp.email) employeeMap.set(emp.email.toLowerCase(), emp.id)
        }

        let created = 0
        let updated = 0
        let skipped = 0

        for (const emp of employees) {
            if (!emp.email) {
                skipped++
                continue
            }

            const email = emp.email.toLowerCase()
            const employeeId = employeeMap.get(email) ?? null

            const existingUser = await userRepo.findOne({ where: { email } })

            if (existingUser) {
                // Update: link employee & sync name/active status
                let changed = false
                if (existingUser.employeeId !== employeeId) {
                    existingUser.employeeId = employeeId
                    changed = true
                }
                if (existingUser.name !== emp.full_name) {
                    existingUser.name = emp.full_name
                    changed = true
                }
                if (existingUser.isActive !== (emp.active_status === "Active")) {
                    existingUser.isActive = emp.active_status === "Active"
                    changed = true
                }
                if (changed) {
                    await userRepo.save(existingUser)
                    updated++
                }
            } else {
                // Create new user
                await userRepo.save(userRepo.create({
                    name: emp.full_name,
                    email,
                    isActive: emp.active_status === "Active",
                    roleId: ROLE_EMPLOYEE,
                    employeeId,
                }))
                created++
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`[Sync] Completed in ${duration}s. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`)

        await AppDataSource.destroy()
        process.exit(0)
    } catch (error) {
        console.error("[Sync] Failed:", error)
        process.exit(1)
    }
}

sync()