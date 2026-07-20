import { AppDataSource } from "../config/database"
import { User } from "../modules/user/entities/user.entity"
import { Role } from "../modules/role/entities/role.entity"
import { nusaworkHelper } from "../core/helpers/nusawork"

async function sync() {
    try {
        console.log("[Sync] Starting user sync from Nusawork...")
        const startTime = Date.now()

        await AppDataSource.initialize()
        console.log("[Sync] App database connected")

        const roleRepo = AppDataSource.getRepository(Role)
        let employeeRole = await roleRepo.findOne({ where: { name: 'Employee' } })
        if (!employeeRole) {
            console.log("[Sync] 'Employee' role not found. Creating one...")
            employeeRole = roleRepo.create({ name: 'Employee', isSuperAdmin: false })
            await roleRepo.save(employeeRole)
        }

        const employees = await nusaworkHelper.getEmployees()
        if (employees.length === 0) {
            console.log("[Sync] No employees found from Nusawork to sync users")
            await AppDataSource.destroy()
            process.exit(0)
        }

        console.log(`[Sync] Fetched ${employees.length} employees from Nusawork`)

        const userRepo = AppDataSource.getRepository(User)
        
        // Fetch all existing users to map by email
        const existingUsers = await userRepo.find()
        const existingUsersMap = new Map<string, User>()
        for (const user of existingUsers) {
            existingUsersMap.set(user.email.toLowerCase(), user)
        }

        let createdCount = 0
        let updatedCount = 0

        const batchSize = 500
        for (let i = 0; i < employees.length; i += batchSize) {
            const batch = employees.slice(i, i + batchSize)
            const entities: User[] = []

            for (const emp of batch) {
                if (!emp.email) continue

                const emailLower = emp.email.toLowerCase()
                const existing = existingUsersMap.get(emailLower)

                // If user exists with this email but a different ID, suffix the old user record
                if (existing && existing.id !== emp.user_id) {
                    console.log(`[Sync] Found ID change for user email ${emp.email} (Old ID: ${existing.id}, New ID: ${emp.user_id}). Suffixing old record.`)
                    existing.email = `${existing.email}_old_${existing.id}`
                    existing.isActive = false
                    await userRepo.save(existing)
                    existingUsersMap.delete(emailLower)
                }
            }

            for (const emp of batch) {
                if (!emp.email) continue

                const emailLower = emp.email.toLowerCase()
                const existing = existingUsersMap.get(emailLower)

                if (existing) {
                    // Update existing user properties
                    const updated = userRepo.create({
                        ...existing,
                        name: emp.full_name,
                        photo: emp.photo_profile,
                        isActive: emp.active_status === 'Active',
                        employeeId: emp.user_id,
                    })
                    entities.push(updated)
                    updatedCount++
                } else {
                    // Create new user
                    const newUser = userRepo.create({
                        id: emp.user_id,
                        name: emp.full_name,
                        email: emp.email,
                        photo: emp.photo_profile,
                        isActive: emp.active_status === 'Active',
                        roleId: employeeRole.id,
                        employeeId: emp.user_id,
                    })
                    entities.push(newUser)
                    createdCount++
                }
            }

            if (entities.length > 0) {
                await userRepo.save(entities)
            }
            console.log(`[Sync] Batch ${Math.floor(i / batchSize) + 1}: processed ${entities.length} users`)
        }

        // Deactivate users not in Nusawork response (only for synced users who have employeeId)
        const nusaworkIds = new Set(employees.map(emp => emp.user_id))
        const missingUsers = existingUsers.filter(user => user.employeeId && !nusaworkIds.has(user.employeeId) && user.isActive)
        if (missingUsers.length > 0) {
            for (const user of missingUsers) {
                user.isActive = false
            }
            await userRepo.save(missingUsers)
            console.log(`[Sync] Marked ${missingUsers.length} missing/resigned users as inactive.`)
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`[Sync] Completed in ${duration}s. Created ${createdCount} users, updated ${updatedCount} users.`)

        await AppDataSource.destroy()
        process.exit(0)
    } catch (error) {
        console.error("[Sync] Failed:", error)
        process.exit(1)
    }
}

sync()
