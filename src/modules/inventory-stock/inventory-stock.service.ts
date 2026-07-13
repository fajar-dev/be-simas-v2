import { InventoryStockBalance } from "./entities/inventory-stock-balance.entity"
import { InventoryStockHolding } from "./entities/inventory-stock-holding.entity"
import { InventoryVariant } from "../inventory-variant/entities/inventory-variant.entity"
import { IInventoryStockRepository, InventoryStockBalanceFilter, InventoryStockMovementFilter, InventoryStockHoldingFilter } from "./interfaces/inventory-stock.repository.interface"
import { InventoryStockEntryValidator, InventoryStockAddValidator, InventoryStockTransferValidator, InventoryStockAssignValidator, InventoryStockReturnValidator } from "./validators/inventory-stock.validator"
import { BadRequestException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { InventoryVariantService } from "../inventory-variant/inventory-variant.service"
import { InventoryService } from "../inventory/inventory.service"
import { BranchService } from "../branch/branch.service"
import { EmployeeService } from "../employee/employee.service"
import { AttachmentService } from "../attachment/attachment.service"
import { STOCK_CONDITIONS, StockCondition } from "../../core/enums"

const ENTITY_MOVEMENT = "InventoryStockMovement"

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
        private readonly attachmentService: AttachmentService
    ) {}

    /** Variants of an item + current on-hand quantities for a branch (for the nested input form). Unit comes from the item. */
    async getEntryTemplate(branchId: number, inventoryId: number): Promise<{ variants: InventoryVariant[]; balances: InventoryStockBalance[]; unit: string }> {
        await this.branchService.getById(branchId)
        const item = await this.inventoryService.getById(inventoryId)
        const variants = await this.inventoryVariantService.getByInventory(inventoryId)
        const balances = await this.repository.findBalancesByBranchAndVariants(branchId, variants.map((v) => v.id))
        return { variants, balances, unit: item.unit }
    }

    /** Set absolute new/used quantities per variant for a branch (opname-style). Records deltas as movements. */
    async entry(data: InventoryStockEntryValidator, userId?: number): Promise<InventoryStockBalance[]> {
        await this.branchService.getById(data.branchId)
        const variants = await this.inventoryVariantService.getByInventory(data.inventoryId)
        const validIds = new Set(variants.map((v) => v.id))
        for (const item of data.items) {
            if (!validIds.has(item.variantId)) {
                throw new BadRequestException(`Variant ${item.variantId} does not belong to item ${data.inventoryId}`)
            }
        }

        return await withTransaction(async (manager) => {
            const updated: InventoryStockBalance[] = []
            for (const item of data.items) {
                for (const condition of STOCK_CONDITIONS) {
                    const target = condition === "new" ? item.new : item.used
                    const existing = await this.repository.findBalance(data.branchId, item.variantId, condition, manager, true)
                    const current = existing?.quantity ?? 0
                    if (target === current) {
                        if (existing) updated.push(existing)
                        continue
                    }
                    const bal = await this.repository.saveBalance({
                        ...(existing ? { id: existing.id } : {}),
                        branchId: data.branchId,
                        variantId: item.variantId,
                        condition,
                        quantity: target,
                    }, manager)
                    await this.repository.saveMovement({
                        variantId: item.variantId,
                        branchId: data.branchId,
                        condition,
                        type: "entry",
                        quantity: target - current,
                        balanceAfter: target,
                        note: "Stock entry",
                        createdByUserId: userId ?? null,
                    }, manager)
                    updated.push(bal)
                }
            }
            return updated
        })
    }

    /** Stock-in: ADD quantities to variants across one or more branches (increments). Optional note + attachments. */
    async add(data: InventoryStockAddValidator, userId?: number): Promise<InventoryStockBalance[]> {
        const variants = await this.inventoryVariantService.getByInventory(data.inventoryId)
        const validIds = new Set(variants.map((v) => v.id))
        const branchIds = new Set(data.items.map((i) => i.branchId))
        for (const bid of branchIds) await this.branchService.getById(bid)
        for (const item of data.items) {
            if (!validIds.has(item.variantId)) {
                throw new BadRequestException(`Variant ${item.variantId} does not belong to item ${data.inventoryId}`)
            }
        }

        const referenceId = `IN-${Date.now()}`
        const attachmentIds = data.attachmentIds ?? []

        return await withTransaction(async (manager) => {
            const updated: InventoryStockBalance[] = []
            for (const item of data.items) {
                for (const condition of STOCK_CONDITIONS) {
                    const qty = condition === "new" ? item.new : item.used
                    if (qty <= 0) continue
                    const existing = await this.repository.findBalance(item.branchId, item.variantId, condition, manager, true)
                    const newQty = (existing?.quantity ?? 0) + qty
                    const bal = await this.repository.saveBalance({
                        ...(existing ? { id: existing.id } : {}),
                        branchId: item.branchId,
                        variantId: item.variantId,
                        condition,
                        quantity: newQty,
                    }, manager)
                    const movement = await this.repository.saveMovement({
                        variantId: item.variantId,
                        branchId: item.branchId,
                        condition,
                        type: "entry",
                        quantity: qty,
                        balanceAfter: newQty,
                        referenceId,
                        note: data.note ?? "Stock in",
                        createdByUserId: userId ?? null,
                    }, manager)
                    if (attachmentIds.length) {
                        await this.attachmentService.associate(attachmentIds, ENTITY_MOVEMENT, movement.id, manager)
                    }
                    updated.push(bal)
                }
            }
            return updated
        })
    }

    async getBalances(page: number, limit: number, filters: InventoryStockBalanceFilter) {
        return await this.repository.findBalances(page, limit, filters)
    }

    /** Move stock between branches, preserving condition, atomic and non-negative. */
    async transfer(data: InventoryStockTransferValidator, userId?: number): Promise<{ referenceId: string }> {
        if (data.fromBranchId === data.toBranchId) {
            throw new BadRequestException("Source and destination branch must be different")
        }
        await this.branchService.getById(data.fromBranchId)
        await this.branchService.getById(data.toBranchId)

        // No duplicate (variant, condition) within one transfer
        const seen = new Set<string>()
        for (const item of data.items) {
            const key = `${item.variantId}:${item.condition}`
            if (seen.has(key)) throw new BadRequestException("Duplicate variant/condition in transfer")
            seen.add(key)
        }

        const referenceId = `TRF-${Date.now()}`
        await withTransaction(async (manager) => {
            for (const item of data.items) {
                // Source: lock, check sufficiency, decrement (condition preserved)
                const from = await this.repository.findBalance(data.fromBranchId, item.variantId, item.condition, manager, true)
                const available = from?.quantity ?? 0
                if (available < item.quantity) {
                    const variant = await this.inventoryVariantService.getById(item.variantId).catch(() => null)
                    throw new BadRequestException(`Insufficient ${item.condition} stock for "${variant?.name || item.variantId}" at source branch (available: ${available})`)
                }
                const newFrom = available - item.quantity
                await this.repository.saveBalance({ id: from!.id, quantity: newFrom }, manager)
                await this.repository.saveMovement({
                    variantId: item.variantId, branchId: data.fromBranchId, condition: item.condition,
                    type: "transfer_out", quantity: -item.quantity, balanceAfter: newFrom,
                    referenceId, note: data.note ?? null, createdByUserId: userId ?? null,
                }, manager)

                // Destination: upsert, increment (same condition)
                const to = await this.repository.findBalance(data.toBranchId, item.variantId, item.condition, manager, true)
                const newTo = (to?.quantity ?? 0) + item.quantity
                await this.repository.saveBalance({
                    ...(to ? { id: to.id } : {}),
                    branchId: data.toBranchId, variantId: item.variantId, condition: item.condition, quantity: newTo,
                }, manager)
                await this.repository.saveMovement({
                    variantId: item.variantId, branchId: data.toBranchId, condition: item.condition,
                    type: "transfer_in", quantity: item.quantity, balanceAfter: newTo,
                    referenceId, note: data.note ?? null, createdByUserId: userId ?? null,
                }, manager)
            }
        })
        return { referenceId }
    }

    async getMovements(page: number, limit: number, filters: InventoryStockMovementFilter) {
        return await this.repository.findMovements(page, limit, filters)
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
        for (const item of data.items) {
            await this.inventoryVariantService.getById(item.variantId)
            await this.branchService.getById(item.branchId)
        }

        return await withTransaction(async (manager) => {
            const holdings: InventoryStockHolding[] = []
            for (const item of data.items) {
                const balance = await this.repository.findBalance(item.branchId, item.variantId, item.condition, manager, true)
                const available = balance?.quantity ?? 0
                if (available < item.quantity) {
                    const variant = await this.inventoryVariantService.getById(item.variantId).catch(() => null)
                    throw new BadRequestException(`Insufficient ${item.condition} stock for "${variant?.name || item.variantId}" at source branch (available: ${available})`)
                }
                const newQty = available - item.quantity
                await this.repository.saveBalance({ id: balance!.id, quantity: newQty }, manager)
                await this.repository.saveMovement({
                    variantId: item.variantId, branchId: item.branchId, condition: item.condition,
                    type: "assign_out", quantity: -item.quantity, balanceAfter: newQty,
                    note: data.note ?? null, createdByUserId: userId ?? null,
                }, manager)

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
        await this.employeeService.getById(data.employeeId)
        for (const item of data.items) {
            await this.inventoryVariantService.getById(item.variantId)
            await this.branchService.getById(item.branchId)
        }

        await withTransaction(async (manager) => {
            for (const item of data.items) {
                const holdings = await this.repository.findActiveHoldings(data.employeeId, item.variantId, manager, true)
                const remaining = holdings.reduce((sum, h) => sum + (h.quantity - h.quantityReturned), 0)
                if (remaining < item.quantity) {
                    const variant = await this.inventoryVariantService.getById(item.variantId).catch(() => null)
                    throw new BadRequestException(`Cannot return ${item.quantity} of "${variant?.name || item.variantId}" — employee only holds ${remaining}`)
                }

                // Returned stock lands in `used` at the destination branch.
                const toBal = await this.repository.findBalance(item.branchId, item.variantId, "used", manager, true)
                const newTo = (toBal?.quantity ?? 0) + item.quantity
                await this.repository.saveBalance({
                    ...(toBal ? { id: toBal.id } : {}),
                    branchId: item.branchId, variantId: item.variantId, condition: "used", quantity: newTo,
                }, manager)
                await this.repository.saveMovement({
                    variantId: item.variantId, branchId: item.branchId, condition: "used",
                    type: "return_in", quantity: item.quantity, balanceAfter: newTo,
                    note: data.note ?? null, createdByUserId: userId ?? null,
                }, manager)

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
            }
        })
    }
}
