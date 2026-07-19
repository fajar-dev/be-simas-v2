import { EntityManager } from "typeorm"
import { InventoryStockBalance } from "./entities/inventory-stock-balance.entity"
import { InventoryStockHolding } from "./entities/inventory-stock-holding.entity"
import { InventoryVariant } from "../inventory-variant/entities/inventory-variant.entity"
import { IInventoryStockRepository, InventoryStockBalanceFilter, InventoryStockHoldingFilter } from "./interfaces/inventory-stock.repository.interface"
import { InventoryStockEntryValidator, InventoryStockAssignValidator, InventoryStockReturnValidator } from "./validators/inventory-stock.validator"
import { BadRequestException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { InventoryVariantService } from "../inventory-variant/inventory-variant.service"
import { InventoryService } from "../inventory/inventory.service"
import { BranchService } from "../branch/branch.service"
import { EmployeeService } from "../employee/employee.service"
import { InventoryLogService } from "../inventory-log/inventory-log.service"
import { STOCK_CONDITIONS, StockCondition } from "../../core/enums"

/** Extra context passed when assign/return is driven by a handover approval. */
export interface InventoryStockHandoverContext {
    handoverId?: number
}

export class InventoryStockService {
    constructor(
        private readonly repository: IInventoryStockRepository,
        private readonly inventoryVariantService: InventoryVariantService,
        private readonly branchService: BranchService,
        private readonly employeeService: EmployeeService,
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
     * every module that adds stock (stock-in, transfer destination, entry).
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
     * Shared by every module that removes stock (transfer source, assign).
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

    async getHoldings(page: number, limit: number, filters: InventoryStockHoldingFilter) {
        return await this.repository.findHoldings(page, limit, filters)
    }

    /** On-hand quantity of a condition at a branch (unlocked read). */
    async getAvailable(branchId: number, variantId: number, condition: StockCondition): Promise<number> {
        const balance = await this.repository.findBalance(branchId, variantId, condition)
        return balance?.quantity ?? 0
    }

    /** Total quantity an employee still holds (not yet returned) for a variant. */
    async getRemainingHeld(employeeId: number, variantId: number): Promise<number> {
        const holdings = await this.repository.findActiveHoldings(employeeId, variantId)
        return holdings.reduce((sum, h) => sum + (h.quantity - h.quantityReturned), 0)
    }

    /** Best-effort pre-check that an assign can be fulfilled (validated again, with locks, on approval). */
    async assertCanAssign(items: InventoryStockAssignValidator["items"]): Promise<void> {
        for (const item of items) {
            const variant = await this.inventoryVariantService.getById(item.variantId)
            await this.branchService.getById(item.branchId)
            const available = await this.getAvailable(item.branchId, item.variantId, item.condition)
            if (available < item.quantity) {
                throw new BadRequestException(`Insufficient ${item.condition} stock for "${variant.name}" at source branch (available: ${available})`)
            }
        }
    }

    /** Best-effort pre-check that an employee holds enough to return (re-checked, with locks, on approval). */
    async assertCanReturn(employeeId: number, items: InventoryStockReturnValidator["items"]): Promise<void> {
        const perVariant = new Map<number, number>()
        for (const item of items) {
            const variant = await this.inventoryVariantService.getById(item.variantId)
            await this.branchService.getById(item.branchId)
            perVariant.set(item.variantId, (perVariant.get(item.variantId) ?? 0) + item.quantity)
            const requested = perVariant.get(item.variantId)!
            const remaining = await this.getRemainingHeld(employeeId, item.variantId)
            if (remaining < requested) {
                throw new BadRequestException(`Cannot return ${requested} of "${variant.name}" — employee only holds ${remaining}`)
            }
        }
    }

    /**
     * Assign stock from a branch to an employee: reduce the branch's on-hand
     * quantity for the chosen condition (never negative) and record a holding.
     * Reused by the manual endpoint and by handover approval.
     */
    async assign(data: InventoryStockAssignValidator, userId?: number, ctx: InventoryStockHandoverContext = {}): Promise<InventoryStockHolding[]> {
        const employee = await this.employeeService.getById(data.employeeId)
        if (!employee.isActive) {
            throw new BadRequestException(`Cannot assign stock to inactive employee "${employee.name}"`)
        }
        const variants = new Map<number, InventoryVariant>()
        for (const item of data.items) {
            variants.set(item.variantId, await this.inventoryVariantService.getById(item.variantId))
            await this.branchService.getById(item.branchId)
        }

        return await withTransaction(async (manager) => {
            const holdings: InventoryStockHolding[] = []
            const inventoryIds = new Set<number>()
            for (const item of data.items) {
                await this.decreaseBalance(item.branchId, item.variantId, item.condition, item.quantity, manager)

                const holding = await this.repository.saveHolding({
                    variantId: item.variantId,
                    employeeId: data.employeeId,
                    branchId: item.branchId,
                    conditionAssigned: item.condition,
                    quantity: item.quantity,
                    quantityReturned: 0,
                    assignedDate: new Date().toISOString(),
                    assignNote: data.note ?? null,
                    assignHandoverId: ctx.handoverId ?? null,
                    createdByUserId: userId ?? null,
                }, manager)
                holdings.push(holding)
                const variant = variants.get(item.variantId)
                if (variant?.inventoryId) inventoryIds.add(variant.inventoryId)
            }

            for (const inventoryId of inventoryIds) {
                await this.inventoryLogService.log({
                    inventoryId,
                    module: "stock",
                    action: "assign",
                    description: `Stock assigned to employee "${employee.name}".`,
                    createdByUserId: userId ?? null,
                    newValue: data,
                }, manager)
            }

            return holdings
        })
    }

    /**
     * Return stock an employee holds. Returned stock always comes back as `used`
     * (per policy) at the given branch. Cannot exceed what the employee still
     * holds; holdings are consumed oldest-first (FIFO).
     */
    async returnStock(data: InventoryStockReturnValidator, userId?: number, ctx: InventoryStockHandoverContext = {}): Promise<void> {
        const employee = await this.employeeService.getById(data.employeeId)
        const variants = new Map<number, InventoryVariant>()
        for (const item of data.items) {
            variants.set(item.variantId, await this.inventoryVariantService.getById(item.variantId))
            await this.branchService.getById(item.branchId)
        }

        await withTransaction(async (manager) => {
            const inventoryIds = new Set<number>()
            for (const item of data.items) {
                const holdings = await this.repository.findActiveHoldings(data.employeeId, item.variantId, manager, true)
                const remaining = holdings.reduce((sum, h) => sum + (h.quantity - h.quantityReturned), 0)
                if (remaining < item.quantity) {
                    const variant = await this.inventoryVariantService.getById(item.variantId).catch(() => null)
                    throw new BadRequestException(`Cannot return ${item.quantity} of "${variant?.name || item.variantId}" — employee only holds ${remaining}`)
                }

                // Returned stock lands in `used` at the destination branch.
                await this.increaseBalance(item.branchId, item.variantId, "used", item.quantity, manager)

                // Consume the employee's holdings oldest-first.
                let toReturn = item.quantity
                for (const holding of holdings) {
                    if (toReturn <= 0) break
                    const avail = holding.quantity - holding.quantityReturned
                    if (avail <= 0) continue
                    const take = Math.min(avail, toReturn)
                    holding.quantityReturned += take
                    toReturn -= take
                    if (holding.quantityReturned >= holding.quantity) {
                        holding.returnedDate = new Date().toISOString()
                        holding.returnNote = data.note ?? holding.returnNote ?? null
                        holding.returnedByUserId = userId ?? null
                        holding.returnHandoverId = ctx.handoverId ?? holding.returnHandoverId ?? null
                    }
                    await this.repository.saveHolding(holding, manager)
                }

                const variant = variants.get(item.variantId)
                if (variant?.inventoryId) inventoryIds.add(variant.inventoryId)
            }

            for (const inventoryId of inventoryIds) {
                await this.inventoryLogService.log({
                    inventoryId,
                    module: "stock",
                    action: "return",
                    description: `Stock returned from employee "${employee.name}".`,
                    createdByUserId: userId ?? null,
                    newValue: data,
                }, manager)
            }
        })
    }
}
