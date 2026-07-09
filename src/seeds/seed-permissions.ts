import "reflect-metadata"
import { AppDataSource } from "../config/database"
import { Permission } from "../modules/role/entities/permission.entity"
import { Role } from "../modules/role/entities/role.entity"
import { User } from "../modules/user/entities/user.entity"

const PERMISSIONS = [
    { module: 'dashboard', action: 'read' },
    { module: 'asset', action: 'read' },
    { module: 'asset', action: 'create' },
    { module: 'asset', action: 'update' },
    { module: 'asset', action: 'delete' },
    { module: 'asset', action: 'export' },
    { module: 'asset', action: 'import' },
    { module: 'category', action: 'read' },
    { module: 'category', action: 'create' },
    { module: 'category', action: 'update' },
    { module: 'category', action: 'delete' },
    { module: 'sub-category', action: 'read' },
    { module: 'sub-category', action: 'create' },
    { module: 'sub-category', action: 'update' },
    { module: 'sub-category', action: 'delete' },
    { module: 'branch', action: 'read' },
    { module: 'branch', action: 'create' },
    { module: 'branch', action: 'update' },
    { module: 'branch', action: 'delete' },
    { module: 'location', action: 'read' },
    { module: 'location', action: 'create' },
    { module: 'location', action: 'update' },
    { module: 'location', action: 'delete' },
    { module: 'employee', action: 'read' },
    { module: 'employee', action: 'create' },
    { module: 'employee', action: 'update' },
    { module: 'employee', action: 'delete' },
    { module: 'asset-holder', action: 'read' },
    { module: 'asset-holder', action: 'create' },
    { module: 'asset-holder', action: 'return' },
    { module: 'asset-location', action: 'read' },
    { module: 'asset-location', action: 'create' },
    { module: 'asset-maintenance', action: 'read' },
    { module: 'asset-maintenance', action: 'create' },
    { module: 'asset-maintenance', action: 'update' },
    { module: 'asset-maintenance', action: 'delete' },
    { module: 'asset-note', action: 'read' },
    { module: 'asset-note', action: 'create' },
    { module: 'asset-note', action: 'update' },
    { module: 'asset-note', action: 'delete' },
    { module: 'asset', action: 'print-code' },
    { module: 'asset-status', action: 'read' },
    { module: 'asset-status', action: 'create' },
    { module: 'handover', action: 'read' },
    { module: 'handover', action: 'create' },
    { module: 'handover', action: 'update' },
    { module: 'handover', action: 'delete' },
    { module: 'handover', action: 'approve' },
    { module: 'handover', action: 'reject' },
    { module: 'handover', action: 'cancel' },
    { module: 'user', action: 'read' },
    { module: 'user', action: 'create' },
    { module: 'user', action: 'update' },
    { module: 'user', action: 'delete' },
    { module: 'role', action: 'read' },
    { module: 'role', action: 'create' },
    { module: 'role', action: 'update' },
    { module: 'role', action: 'delete' },
]

async function seed() {
    await AppDataSource.initialize()
    console.log('Database connected')

    const permRepo = AppDataSource.getRepository(Permission)
    const roleRepo = AppDataSource.getRepository(Role)
    const userRepo = AppDataSource.getRepository(User)

    // Upsert permissions
    for (const p of PERMISSIONS) {
        const key = `${p.module}:${p.action}`
        const existing = await permRepo.findOne({ where: { key } })
        if (!existing) {
            await permRepo.save(permRepo.create({ key, module: p.module, action: p.action }))
            console.log(`  Created permission: ${key}`)
        }
    }

    // Get all permissions
    const allPermissions = await permRepo.find()

    // Create or update Super Admin role
    let superAdmin = await roleRepo.findOne({ where: { name: 'Super Admin' } })
    if (!superAdmin) {
        superAdmin = roleRepo.create({ name: 'Super Admin', isSuperAdmin: true })
    }
    superAdmin.isSuperAdmin = true
    superAdmin.permissions = allPermissions
    await roleRepo.save(superAdmin)
    console.log('Super Admin role ready with all permissions')

    // Assign all users without a role to Super Admin
    const usersNoRole = await userRepo
        .createQueryBuilder('user')
        .where('user.role_id IS NULL')
        .getMany()

    for (const user of usersNoRole) {
        user.roleId = superAdmin.id
        await userRepo.save(user)
        console.log(`  Assigned Super Admin to user: ${user.name}`)
    }

    // Create or update Employee role
    const employeePermissionKeys = [
        'asset:read',
        'asset-holder:read',
        'asset-location:read',
        'asset-maintenance:read',
        'asset-note:read',
        'asset-status:read',
        'asset:print-code',
        'dashboard:read',
    ]
    const employeePermissions = allPermissions.filter(p => employeePermissionKeys.includes(p.key))

    let employeeRole = await roleRepo.findOne({ where: { name: 'Employee' } })
    if (!employeeRole) {
        employeeRole = roleRepo.create({ name: 'Employee', isSuperAdmin: false })
    }
    employeeRole.isSuperAdmin = false
    employeeRole.permissions = employeePermissions
    await roleRepo.save(employeeRole)
    console.log(`Employee role ready with ${employeePermissions.length} permissions: ${employeePermissionKeys.join(', ')}`)

    console.log('Seed completed!')
    process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
