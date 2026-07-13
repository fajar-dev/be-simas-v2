import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { InventoryStockMovement } from "../entities/inventory-stock-movement.entity"
import { InventoryStockHolding } from "../entities/inventory-stock-holding.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class InventoryStockSerializer {

    static holding(h: InventoryStockHolding) {
        return {
            id: h.id,
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

    static holdings(items: InventoryStockHolding[]) {
        return items.map((h) => this.holding(h))
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

    static async movement(m: InventoryStockMovement) {
        return {
            id: m.id,
            type: m.type,
            condition: m.condition,
            quantity: m.quantity,
            balanceAfter: m.balanceAfter ?? null,
            referenceId: m.referenceId || null,
            note: m.note || null,
            createdAt: m.createdAt,
            branch: m.branch ? { id: m.branch.id, name: m.branch.name } : null,
            variant: m.variant ? {
                id: m.variant.id,
                name: m.variant.name,
                inventory: m.variant.inventory ? { id: m.variant.inventory.id, name: m.variant.inventory.name } : null,
            } : null,
            createdBy: m.createdBy ? {
                id: m.createdBy.id,
                name: m.createdBy.name,
                photo: await resolveFileUrl(m.createdBy.photo),
            } : null,
        }
    }

    static async movements(items: InventoryStockMovement[]) {
        return Promise.all(items.map((m) => this.movement(m)))
    }
}
