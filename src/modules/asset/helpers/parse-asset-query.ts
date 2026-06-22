import { Context } from "hono"
import { AssetFilter } from "../interfaces/asset.repository.interface"

/**
 * Parse asset filter + search params from Hono Context
 * Shared between index and export controllers
 */
export function parseAssetQueryParams(c: Context) {
    const q = c.req.query("q") || ""
    const sortBy = c.req.query("sortBy") || undefined
    const order = (c.req.query("order") || "DESC").toUpperCase() as 'ASC' | 'DESC'

    const parseIds = (val: string | undefined) =>
        val ? val.split(',').map(Number).filter(n => !isNaN(n)) : undefined

    const filters: AssetFilter = {}
    const categoryIds = parseIds(c.req.query("categoryIds"))
    if (categoryIds?.length) filters.categoryIds = categoryIds
    const subCategoryIds = parseIds(c.req.query("subCategoryIds"))
    if (subCategoryIds?.length) filters.subCategoryIds = subCategoryIds
    const branchIds = parseIds(c.req.query("branchIds"))
    if (branchIds?.length) filters.branchIds = branchIds
    const locationIds = parseIds(c.req.query("locationIds"))
    if (locationIds?.length) filters.locationIds = locationIds

    const statusParam = c.req.query("status")
    if (statusParam) filters.status = statusParam.split(',')

    const holderStatus = c.req.query("holderStatus")
    if (holderStatus === 'has_holder' || holderStatus === 'no_holder') filters.holderStatus = holderStatus
    if (c.req.query("holderId")) filters.holderId = Number(c.req.query("holderId"))
    if (c.req.query("priceMin")) filters.priceMin = Number(c.req.query("priceMin"))
    if (c.req.query("priceMax")) filters.priceMax = Number(c.req.query("priceMax"))
    if (c.req.query("purchaseDateFrom")) filters.purchaseDateFrom = c.req.query("purchaseDateFrom")!
    if (c.req.query("purchaseDateTo")) filters.purchaseDateTo = c.req.query("purchaseDateTo")!
    const missingFields = c.req.query("missingFields")
    if (missingFields) filters.missingFields = missingFields.split(',')

    // Parse label filters: label.{key}=value
    const allQueries = c.req.queries()
    const labelFilters: { key: string; value: string }[] = []
    for (const [qKey, values] of Object.entries(allQueries)) {
        if (qKey.startsWith('label.') && values?.[0]) {
            labelFilters.push({ key: qKey.substring(6), value: values[0] })
        }
    }
    if (labelFilters.length) filters.labels = labelFilters

    return { q, sortBy, order, filters }
}
