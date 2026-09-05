import { AssetSchedule } from "./entities/asset-schedule.entity"
import { IAssetScheduleRepository, AssetScheduleFilter } from "./interfaces/asset-schedule.repository.interface"
import { NotFoundException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { AssetService } from "../asset/asset.service"
import { UserService } from "../user/user.service"
import { AttachmentService } from "../attachment/attachment.service"
import { AssetScheduleWithAttachments } from "./serializers/asset-schedule.serialize"
import { expandOccurrences } from "./recurrence"
import { CreateAssetScheduleValidator, UpdateAssetScheduleValidator } from "./validators/asset-schedule.validator"
import type { ScheduleRecurrence } from "../../core/enums"

const ENTITY_ASSET_SCHEDULE = "AssetSchedule"

export type ScheduleOccurrence = { schedule: AssetSchedule; date: string; isRecurring: boolean }

export class AssetScheduleService {
    constructor(
        private readonly repository: IAssetScheduleRepository,
        private readonly assetService: AssetService,
        private readonly userService: UserService,
        private readonly attachmentService: AttachmentService
    ) {}

    async getAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: "ASC" | "DESC",
        filters?: AssetScheduleFilter
    ): Promise<{ data: AssetScheduleWithAttachments[]; total: number }> {
        const { data, total } = await this.repository.findAll(page, limit, q, sortBy, order, filters)
        const withAttachments = await this.attachEach(data)
        return { data: withAttachments, total }
    }

    async getById(id: number): Promise<AssetScheduleWithAttachments> {
        const schedule = await this.findOrFail(id)
        const attachments = await this.attachmentService.getForEntity(ENTITY_ASSET_SCHEDULE, id)
        return { schedule, attachments }
    }

    /**
     * Expand every schedule that can touch `[from, to]` into concrete dated
     * occurrences, sorted by date — this is what the calendar renders.
     */
    async getCalendar(from: string, to: string, filters?: AssetScheduleFilter): Promise<ScheduleOccurrence[]> {
        const schedules = await this.repository.findForRange(from, to, filters)
        const occurrences: ScheduleOccurrence[] = []

        for (const schedule of schedules) {
            for (const date of expandOccurrences(schedule, from, to)) {
                occurrences.push({ schedule, date, isRecurring: schedule.recurrence !== "none" })
            }
        }

        occurrences.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

        return occurrences
    }

    async create(data: CreateAssetScheduleValidator, userId?: number): Promise<AssetScheduleWithAttachments> {
        await this.assertAssetsExist(data.assetIds)
        if (data.userIds?.length) await this.assertUsersExist(data.userIds)
        const pattern = this.normalizePattern(data.recurrence, data)

        const created = await withTransaction(async (manager) => {
            const schedule = await this.repository.save(
                {
                    title: data.title,
                    description: data.description ?? null,
                    startDate: data.startDate,
                    recurrence: data.recurrence,
                    ...pattern,
                    createdByUserId: userId ?? null,
                },
                manager
            )

            await this.repository.setAssets(schedule.id, data.assetIds, manager)

            // Assigning users is optional — a schedule may be created with nobody assigned.
            if (data.userIds?.length) {
                await this.repository.setUsers(schedule.id, data.userIds, manager)
            }

            if (data.attachmentIds?.length) {
                await this.attachmentService.associate(data.attachmentIds, ENTITY_ASSET_SCHEDULE, schedule.id, manager)
            }

            return schedule
        })

        return await this.getById(created.id)
    }

    async update(id: number, data: UpdateAssetScheduleValidator): Promise<AssetScheduleWithAttachments> {
        const schedule = await this.findOrFail(id)

        if (data.assetIds) await this.assertAssetsExist(data.assetIds)
        if (data.userIds?.length) await this.assertUsersExist(data.userIds)

        await withTransaction(async (manager) => {
            const patch: Partial<AssetSchedule> = {}
            if (data.title !== undefined) patch.title = data.title
            if (data.description !== undefined) patch.description = data.description ?? null
            if (data.startDate !== undefined) patch.startDate = data.startDate

            if (data.recurrence !== undefined) {
                // Recurrence change → renormalize pattern fields from the incoming payload.
                patch.recurrence = data.recurrence
                Object.assign(patch, this.normalizePattern(data.recurrence, data))
            } else {
                // No recurrence change → allow tweaking the current mode's pattern fields.
                if (data.daysOfWeek !== undefined) patch.daysOfWeek = data.daysOfWeek ?? null
                if (data.dayOfMonth !== undefined) patch.dayOfMonth = data.dayOfMonth ?? null
                if (data.month !== undefined) patch.month = data.month ?? null
                if (data.recurrenceEndDate !== undefined) patch.recurrenceEndDate = data.recurrenceEndDate ?? null
            }

            this.repository.merge(schedule, patch)
            await this.repository.save(schedule, manager)

            if (data.assetIds) {
                await this.repository.setAssets(id, data.assetIds, manager)
            }

            // `!== undefined` (not truthy) so an explicit empty array clears all assigned users.
            if (data.userIds !== undefined) {
                await this.repository.setUsers(id, data.userIds, manager)
            }

            if (data.attachmentIds !== undefined) {
                await this.attachmentService.disassociateOrphans(ENTITY_ASSET_SCHEDULE, id, data.attachmentIds, manager)
                await this.attachmentService.associate(data.attachmentIds, ENTITY_ASSET_SCHEDULE, id, manager)
            }
        })

        return await this.getById(id)
    }

    async delete(id: number): Promise<void> {
        await this.findOrFail(id)
        await withTransaction(async (manager) => {
            const attachments = await this.attachmentService.getForEntity(ENTITY_ASSET_SCHEDULE, id)
            for (const attachment of attachments) {
                await this.attachmentService.delete(attachment.id, manager)
            }
            await this.repository.delete(id)
        })
    }

    /** Keep only the pattern fields relevant to `recurrence`; null out the rest. */
    private normalizePattern(
        recurrence: ScheduleRecurrence,
        data: { daysOfWeek?: number[] | null; dayOfMonth?: number | null; month?: number | null; recurrenceEndDate?: string | null }
    ): Pick<AssetSchedule, "daysOfWeek" | "dayOfMonth" | "month" | "recurrenceEndDate"> {
        if (recurrence === "none") {
            return { daysOfWeek: null, dayOfMonth: null, month: null, recurrenceEndDate: null }
        }
        return {
            daysOfWeek: recurrence === "weekly" ? data.daysOfWeek ?? null : null,
            dayOfMonth: recurrence === "monthly" || recurrence === "yearly" ? data.dayOfMonth ?? null : null,
            month: recurrence === "yearly" ? data.month ?? null : null,
            recurrenceEndDate: data.recurrenceEndDate ?? null,
        }
    }

    private async assertAssetsExist(assetIds: number[]): Promise<void> {
        for (const assetId of assetIds) {
            await this.assetService.getById(assetId) // throws NotFoundException if missing
        }
    }

    private async assertUsersExist(userIds: number[]): Promise<void> {
        for (const userId of userIds) {
            await this.userService.getById(userId) // throws NotFoundException if missing
        }
    }

    private async findOrFail(id: number): Promise<AssetSchedule> {
        const schedule = await this.repository.findById(id)
        if (!schedule) {
            throw new NotFoundException("Asset schedule not found")
        }
        return schedule
    }

    private async attachEach(schedules: AssetSchedule[]): Promise<AssetScheduleWithAttachments[]> {
        return await Promise.all(
            schedules.map(async (schedule) => ({
                schedule,
                attachments: await this.attachmentService.getForEntity(ENTITY_ASSET_SCHEDULE, schedule.id),
            }))
        )
    }
}
