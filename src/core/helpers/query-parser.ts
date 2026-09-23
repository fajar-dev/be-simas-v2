export function parseIds(value: string | undefined): number[] | undefined {
    if (!value) return undefined
    const ids = value.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
    return ids.length > 0 ? ids : undefined
}
