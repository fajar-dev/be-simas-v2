/**
 * Central definition of every fixed-value enum used across the backend.
 *
 * Define the allowed values ONCE here. Both the Zod validators and the TypeORM
 * entities consume these, so adding or changing a value only touches this file.
 *
 * Each enum is a readonly value array (usable by `z.enum(...)`) plus a derived
 * union type (usable as an entity column / property type).
 */

/** Asset lifecycle status — column `asset_statuses.status`. */
export const ASSET_STATUSES = ["active", "idle", "under_repair", "damaged", "lost", "sold", "disposed"] as const
export type AssetStatusValue = (typeof ASSET_STATUSES)[number]

/** Asset handover transaction type — column `handovers.transaction_type`. */
export const HANDOVER_TRANSACTION_TYPES = ["assign", "return"] as const
export type HandoverTransactionType = (typeof HANDOVER_TRANSACTION_TYPES)[number]

/** Asset handover approval status — column `handovers.status`. */
export const HANDOVER_STATUSES = ["pending", "approve", "reject", "cancel"] as const
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number]

/** Origin of an asset location record — column `asset_locations.source`. */
export const ASSET_LOCATION_SOURCES = ["manual", "ble"] as const
export type AssetLocationSource = (typeof ASSET_LOCATION_SOURCES)[number]
