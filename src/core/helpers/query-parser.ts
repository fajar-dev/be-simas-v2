/**
 * Shared query parameter parsing utilities
 * Ensures consistent, safe parsing across all controllers
 */

/**
 * Parse pagination parameters with bounds checking
 */
export function parsePagination(query: { page?: string; limit?: string; perPage?: string }) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1))
    const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit || query.perPage) || 10)))
    return { page, limit }
}

/**
 * Parse a numeric ID parameter, throws if invalid
 */
export function parseId(value: string | undefined): number {
    const id = Number(value)
    if (!value || isNaN(id) || id <= 0 || !Number.isInteger(id)) {
        throw new Error("Invalid ID parameter")
    }
    return id
}

/**
 * Parse comma-separated numeric IDs
 */
export function parseIds(value: string | undefined): number[] | undefined {
    if (!value) return undefined
    const ids = value.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
    return ids.length > 0 ? ids : undefined
}

/**
 * Parse sort order, defaults to DESC
 */
export function parseSortOrder(value: string | undefined): 'ASC' | 'DESC' {
    return value?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
}
