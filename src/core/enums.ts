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

/** What a handover carries — column `handovers.item_kind`. */
export const HANDOVER_ITEM_KINDS = ["asset", "stock"] as const
export type HandoverItemKind = (typeof HANDOVER_ITEM_KINDS)[number]

/** Asset handover approval status — column `handovers.status`. */
export const HANDOVER_STATUSES = ["pending", "approve", "reject", "cancel"] as const
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number]

/** Custom-field input type — column `handover_fields.type`. */
export const HANDOVER_FIELD_TYPES = ["text", "number", "select", "radio", "date", "datetime"] as const
export type HandoverFieldType = (typeof HANDOVER_FIELD_TYPES)[number]

/** Origin of an asset location record — column `asset_locations.source`. */
export const ASSET_LOCATION_SOURCES = ["manual", "ble"] as const
export type AssetLocationSource = (typeof ASSET_LOCATION_SOURCES)[number]

/** Stock condition — column `inventory_stock_balances.condition` / `inventory_stock_movements.condition`. */
export const STOCK_CONDITIONS = ["new", "used"] as const
export type StockCondition = (typeof STOCK_CONDITIONS)[number]

/** Suggested units of measure for an inventory item (`inventories.unit`). Free-text; this list only powers the select. */
export const INVENTORY_UNITS = ["Pcs", "Unit", "Box", "Pack", "Set", "Roll", "Meter", "Cm", "Kg", "Gram", "Liter", "Lusin", "Rim"] as const
export type InventoryUnit = (typeof INVENTORY_UNITS)[number]

/** Stock ledger movement type — column `inventory_stock_movements.type`. */
export const STOCK_MOVEMENT_TYPES = ["entry", "adjustment", "transfer_out", "transfer_in", "assign_out", "return_in"] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]
