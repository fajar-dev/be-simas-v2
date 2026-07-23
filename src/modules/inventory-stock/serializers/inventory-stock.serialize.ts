import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { InventoryStockOut } from "../entities/inventory-stock-out.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"

export class InventoryStockSerializer {

    static stockOut(h: InventoryStockOut) {
        return {
            id: h.id,
            type: h.type,
            conditionAssigned: h.conditionAssigned,
            quantity: h.quantity,
            quantityReturned: h.quantityReturned,
            quantityRemaining: h.quantity - h.quantityReturned,
            assignedDate: h.assignedDate,
            returnedDate: h.returnedDate || null,
            assignNote: h.assignNote || null,
            returnNote: h.returnNote || null,
            assignHandoverId: h.assignHandoverId || null,
            returnHandoverId: h.returnHandoverId || null,
            employee: h.employee ? { id: h.employee.id, name: h.employee.name, employeeId: h.employee.employeeId } : null,
            branch: h.branch ? { id: h.branch.id, name: h.branch.name } : null,
            variant: h.variant ? {
                id: h.variant.id,
                name: h.variant.name,
                code: h.variant.code || null,
                unit: h.variant.inventory?.unit ?? "",
                inventory: h.variant.inventory ? { id: h.variant.inventory.id, name: h.variant.inventory.name, code: h.variant.inventory.code || null } : null,
            } : null,
        }
    }

    static stockOuts(items: InventoryStockOut[]) {
        return items.map((h) => this.stockOut(h))
    }
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
