import { EntityManager } from "typeorm"
import { InventoryStockBalance } from "./entities/inventory-stock-balance.entity"
import { InventoryVariant } from "../inventory-variant/entities/inventory-variant.entity"
import { IInventoryStockRepository, InventoryStockBalanceFilter } from "./interfaces/inventory-stock.repository.interface"
import { InventoryStockEntryValidator } from "./validators/inventory-stock.validator"
import { BadRequestException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { InventoryVariantService } from "../inventory-variant/inventory-variant.service"
import { InventoryService } from "../inventory/inventory.service"
import { BranchService } from "../branch/branch.service"
import { InventoryLogService } from "../inventory-log/inventory-log.service"
import { STOCK_CONDITIONS, StockCondition } from "../../core/enums"

export class InventoryStockService {
    constructor(
        private readonly repository: IInventoryStockRepository,
        private readonly inventoryVariantService: InventoryVariantService,
        private readonly branchService: BranchService,
        private readonly inventoryService: InventoryService,
        private readonly inventoryLogService: InventoryLogService
    ) {}

    /** Variants of an item + current on-hand quantities for a branch (for the nested input form). Unit comes from the item. */
    async getEntryTemplate(branchId: number, inventoryId: number): Promise<{ variants: InventoryVariant[]; balances: InventoryStockBalance[]; unit: string }> {
        await this.branchService.getById(branchId)
        const item = await this.inventoryService.getById(inventoryId)
        const variants = await this.inventoryVariantService.getByInventory(inventoryId)
        const balances = await this.repository.findBalancesByBranchAndVariants(branchId, variants.map((v) => v.id))
        return { variants, balances, unit: item.unit }
    }

    /**
     * Increase a branch/variant/condition balance by qty (upsert). Shared by
     * every module that adds stock (stock-in, transfer destination, entry, stock-out return).
     */
    async increaseBalance(branchId: number, variantId: number, condition: StockCondition, qty: number, manager?: EntityManager): Promise<InventoryStockBalance> {
        const existing = await this.repository.findBalance(branchId, variantId, condition, manager, !!manager)
        const newQty = (existing?.quantity ?? 0) + qty
        return await this.repository.saveBalance({
            ...(existing ? { id: existing.id } : {}),
            branchId, variantId, condition, quantity: newQty,
        }, manager)
    }

    /**
     * Decrease a branch/variant/condition balance by qty; throws if insufficient.
     * Shared by every module that removes stock (transfer source, stock-out assign).
     */
    async decreaseBalance(branchId: number, variantId: number, condition: StockCondition, qty: number, manager?: EntityManager): Promise<InventoryStockBalance> {
        const existing = await this.repository.findBalance(branchId, variantId, condition, manager, !!manager)
        const available = existing?.quantity ?? 0
        if (available < qty) {
            const variant = await this.inventoryVariantService.getById(variantId).catch(() => null)
            throw new BadRequestException(`Insufficient ${condition} stock for "${variant?.name || variantId}" at source branch (available: ${available})`)
        }
        return await this.repository.saveBalance({ id: existing!.id, quantity: available - qty }, manager)
    }

    /** Set absolute new/used quantities per variant for a branch (opname-style). */
    async entry(data: InventoryStockEntryValidator, userId?: number): Promise<InventoryStockBalance[]> {
        await this.branchService.getById(data.branchId)
        const variants = await this.inventoryVariantService.getByInventory(data.inventoryId)
        const validIds = new Set(variants.map((v) => v.id))
        for (const item of data.items) {
            if (!validIds.has(item.variantId)) {
                throw new BadRequestException(`Variant ${item.variantId} does not belong to item ${data.inventoryId}`)
            }
        }

        const updated = await withTransaction(async (manager) => {
            const rows: InventoryStockBalance[] = []
            for (const item of data.items) {
                for (const condition of STOCK_CONDITIONS) {
                    const target = condition === "new" ? item.new : item.used
                    const existing = await this.repository.findBalance(data.branchId, item.variantId, condition, manager, true)
                    const current = existing?.quantity ?? 0
                    if (target === current) {
                        if (existing) rows.push(existing)
                        continue
                    }
                    const bal = await this.repository.saveBalance({
                        ...(existing ? { id: existing.id } : {}),
                        branchId: data.branchId,
                        variantId: item.variantId,
                        condition,
                        quantity: target,
                    }, manager)
                    rows.push(bal)
                }
            }

            await this.inventoryLogService.log({
                inventoryId: data.inventoryId,
                module: "stock",
                action: "entry",
                description: `Stock entry saved for branch #${data.branchId}.`,
                createdByUserId: userId ?? null,
                newValue: data,
            }, manager)

            return rows
        })
        return updated
    }

    async getBalances(page: number, limit: number, filters: InventoryStockBalanceFilter) {
        return await this.repository.findBalances(page, limit, filters)
    }

    /** On-hand quantity of a condition at a branch (unlocked read). */
    async getAvailable(branchId: number, variantId: number, condition: StockCondition): Promise<number> {
        const balance = await this.repository.findBalance(branchId, variantId, condition)
        return balance?.quantity ?? 0
    }
}
