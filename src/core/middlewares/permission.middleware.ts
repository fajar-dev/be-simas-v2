import { Context, Next } from 'hono'
import { ForbiddenException } from '../exceptions/base'

export const requirePermission = (...keys: string[]) => {
    return async (c: Context, next: Next) => {
        const user = c.get('user') as any
        if (!user) {
            throw new ForbiddenException("Access denied")
        }

        // Super admin bypasses all permission checks
        if (user.role?.isSuperAdmin) {
            return next()
        }

        const userPermissions = user.role?.permissions?.map((p: any) => p.key) || []
        const hasPermission = keys.some(key => userPermissions.includes(key))

        if (!hasPermission) {
            throw new ForbiddenException("You don't have permission to perform this action")
        }

        return next()
    }
}
