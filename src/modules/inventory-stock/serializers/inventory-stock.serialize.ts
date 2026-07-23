import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"

export class InventoryStockSerializer {

    static balance(balance: InventoryStockBalance) {
        return {
            id: balance.id,
            condition: balance.condition,
            quantity: balance.quantity,
            updatedAt: balance.updatedAt,
            branch: balance.branch ? { id: balance.branch.id, name: balance.branch.name } : null,
            variant: balance.variant ? {
                id: balance.variant.id,
                name: balance.variant.name,
                code: balance.variant.code || null,
                unit: balance.variant.inventory?.unit ?? "",
                inventory: balance.variant.inventory ? {
                    id: balance.variant.inventory.id,
                    name: balance.variant.inventory.name,
                    code: balance.variant.inventory.code || null,
                } : null,
            } : null,
        }
    }

    static balances(items: InventoryStockBalance[]) {
        return items.map((b) => this.balance(b))
    }

    /**
     * Entry template: each variant with its current on-hand new/used quantities
     * for the selected branch, ready for the nested input table.
     */
    static entryTemplate(variants: InventoryVariant[], balances: InventoryStockBalance[], unit = "") {
        const byKey = new Map<string, number>()
        for (const b of balances) byKey.set(`${b.variantId}:${b.condition}`, b.quantity)
        return variants.map((v) => ({
            variantId: v.id,
            name: v.name,
            code: v.code || null,
            unit,
            new: byKey.get(`${v.id}:new`) ?? 0,
            used: byKey.get(`${v.id}:used`) ?? 0,
        }))
    }
}
