import { InventoryStockOut } from "./entities/inventory-stock-out.entity"
import { IInventoryStockOutRepository, InventoryStockOutFilter } from "./interfaces/inventory-stock-out.repository.interface"
import { InventoryStockAssignValidator, InventoryStockReturnValidator } from "./validators/inventory-stock-out.validator"
import { BadRequestException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { InventoryStockService } from "../inventory-stock/inventory-stock.service"
import { InventoryVariant } from "../inventory-variant/entities/inventory-variant.entity"
import { InventoryVariantService } from "../inventory-variant/inventory-variant.service"
import { BranchService } from "../branch/branch.service"
import { EmployeeService } from "../employee/employee.service"
import { InventoryLogService } from "../inventory-log/inventory-log.service"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"

const ENTITY_STOCK_OUT = "InventoryStockOut"

/** Extra context passed when assign/return is driven by a handover approval. */
export interface InventoryStockOutHandoverContext {
    handoverId?: number
}

export class InventoryStockOutService {
    constructor(
        private readonly repository: IInventoryStockOutRepository,
        private readonly inventoryStockService: InventoryStockService,
        private readonly inventoryVariantService: InventoryVariantService,
        private readonly branchService: BranchService,
        private readonly employeeService: EmployeeService,
        private readonly inventoryLogService: InventoryLogService,
        private readonly attachmentService: AttachmentService
    ) {}

    async getStockOuts(page: number, limit: number, filters: InventoryStockOutFilter): Promise<{ data: { stockOut: InventoryStockOut; attachments: Attachment[] }[]; total: number }> {
        const { data, total } = await this.repository.findStockOuts(page, limit, filters)
        const mapped = await Promise.all(data.map(async (stockOut) => ({
            stockOut,
            attachments: await this.attachmentService.getForEntity(ENTITY_STOCK_OUT, stockOut.id),
        })))
        return { data: mapped, total }
    }

    /** Total quantity an employee still holds (not yet returned) for a variant. */
    async getRemainingHeld(employeeId: number, variantId: number): Promise<number> {
        const stockOuts = await this.repository.findActiveStockOuts(employeeId, variantId)
        return stockOuts.reduce((sum, h) => sum + (h.quantity - h.quantityReturned), 0)
    }

    /** Best-effort pre-check that an assign can be fulfilled (validated again, with locks, on approval). */
    async assertCanAssign(items: InventoryStockAssignValidator["items"]): Promise<void> {
        for (const item of items) {
            const variant = await this.inventoryVariantService.getById(item.variantId)
            await this.branchService.getById(item.branchId)
            const available = await this.inventoryStockService.getAvailable(item.branchId, item.variantId, item.condition)
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
     * Take stock out of a branch: reduce the branch's on-hand quantity for the
     * chosen condition (never negative) and record a stock-out. When
     * `type: "employee"`, the stock-out is returnable and tracked against the
     * employee; when `type: "other"`, it's a one-way exit (consumed, disposed,
     * sold, etc.) with no employee, marked fully resolved at creation.
     * Reused by the manual endpoint and by handover approval (always "employee").
     */
    async assign(data: InventoryStockAssignValidator, userId?: number, ctx: InventoryStockOutHandoverContext = {}): Promise<{ stockOut: InventoryStockOut; attachments: Attachment[] }[]> {
        const employee = data.type === "employee" ? await this.employeeService.getById(data.employeeId!) : null
        if (employee && !employee.isActive) {
            throw new BadRequestException(`Cannot assign stock to inactive employee "${employee.name}"`)
        }
        const variants = new Map<number, InventoryVariant>()
        for (const item of data.items) {
            variants.set(item.variantId, await this.inventoryVariantService.getById(item.variantId))
            await this.branchService.getById(item.branchId)
        }

        const attachmentIds = data.attachmentIds ?? []

        const stockOuts = await withTransaction(async (manager) => {
            const stockOuts: InventoryStockOut[] = []
            const inventoryIds = new Set<number>()
            const now = new Date().toISOString()
            for (const item of data.items) {
                await this.inventoryStockService.decreaseBalance(item.branchId, item.variantId, item.condition, item.quantity, manager)

                const stockOut = await this.repository.saveStockOut({
                    variantId: item.variantId,
                    type: data.type,
                    employeeId: employee?.id ?? null,
                    branchId: item.branchId,
                    conditionAssigned: item.condition,
                    quantity: item.quantity,
                    quantityReturned: data.type === "other" ? item.quantity : 0,
                    assignedDate: now,
                    returnedDate: data.type === "other" ? now : null,
                    assignNote: data.note ?? null,
                    assignHandoverId: ctx.handoverId ?? null,
                    createdByUserId: userId ?? null,
                }, manager)
                stockOuts.push(stockOut)
                const variant = variants.get(item.variantId)
                if (variant?.inventoryId) inventoryIds.add(variant.inventoryId)

                // One assign can produce several independent rows; the first takes
                // ownership of the uploaded attachment, the rest get their own copy
                // of the metadata (same underlying file) so every row shows it.
                if (attachmentIds.length > 0) {
                    if (stockOuts.length === 1) {
                        await this.attachmentService.associate(attachmentIds, ENTITY_STOCK_OUT, stockOut.id, manager)
                    } else {
                        await this.attachmentService.duplicate(attachmentIds, ENTITY_STOCK_OUT, stockOut.id, manager)
                    }
                }
            }

            const description = employee
                ? `Stock assigned to employee "${employee.name}".`
                : "Stock taken out (non-employee)."
            for (const inventoryId of inventoryIds) {
                await this.inventoryLogService.log({
                    inventoryId,
                    module: "stock",
                    action: "assign",
                    description,
                    createdByUserId: userId ?? null,
                    newValue: data,
                }, manager)
            }

            return stockOuts
        })

        return await Promise.all(stockOuts.map(async (stockOut) => ({
            stockOut,
            attachments: await this.attachmentService.getForEntity(ENTITY_STOCK_OUT, stockOut.id),
        })))
    }

    /**
     * Return stock an employee holds. Returned stock always comes back as `used`
     * (per policy) at the given branch. Cannot exceed what the employee still
     * holds; holdings are consumed oldest-first (FIFO).
     */
    async returnStock(data: InventoryStockReturnValidator, userId?: number, ctx: InventoryStockOutHandoverContext = {}): Promise<void> {
        const employee = await this.employeeService.getById(data.employeeId)
        const variants = new Map<number, InventoryVariant>()
        for (const item of data.items) {
            variants.set(item.variantId, await this.inventoryVariantService.getById(item.variantId))
            await this.branchService.getById(item.branchId)
        }

        await withTransaction(async (manager) => {
            const inventoryIds = new Set<number>()
            for (const item of data.items) {
                const stockOuts = await this.repository.findActiveStockOuts(data.employeeId, item.variantId, manager, true)
                const remaining = stockOuts.reduce((sum, h) => sum + (h.quantity - h.quantityReturned), 0)
                if (remaining < item.quantity) {
                    const variant = await this.inventoryVariantService.getById(item.variantId).catch(() => null)
                    throw new BadRequestException(`Cannot return ${item.quantity} of "${variant?.name || item.variantId}" — employee only holds ${remaining}`)
                }

                // Returned stock lands in `used` at the destination branch.
                await this.inventoryStockService.increaseBalance(item.branchId, item.variantId, "used", item.quantity, manager)

                // Consume the employee's stock-outs oldest-first.
                let toReturn = item.quantity
                for (const stockOut of stockOuts) {
                    if (toReturn <= 0) break
                    const avail = stockOut.quantity - stockOut.quantityReturned
                    if (avail <= 0) continue
                    const take = Math.min(avail, toReturn)
                    stockOut.quantityReturned += take
                    toReturn -= take
                    if (stockOut.quantityReturned >= stockOut.quantity) {
                        stockOut.returnedDate = new Date().toISOString()
                        stockOut.returnNote = data.note ?? stockOut.returnNote ?? null
                        stockOut.returnedByUserId = userId ?? null
                        stockOut.returnHandoverId = ctx.handoverId ?? stockOut.returnHandoverId ?? null
                    }
                    await this.repository.saveStockOut(stockOut, manager)
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
