import { EntityManager } from "typeorm"
import { AssetSchedule } from "../entities/asset-schedule.entity"

export interface AssetScheduleFilter {
    assetId?: number
    recurrence?: string
}

export interface IAssetScheduleRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: "ASC" | "DESC",
        filters?: AssetScheduleFilter
    ): Promise<{ data: AssetSchedule[]; total: number }>
    /**
     * Schedules that could produce an occurrence within `[from, to]`:
     * non-recurring rows whose date falls in range, plus any recurring row
     * that started on/before `to` and whose recurrence hasn't ended before `from`.
     */
    findForRange(from: string, to: string, filters?: AssetScheduleFilter): Promise<AssetSchedule[]>
    findById(id: number): Promise<AssetSchedule | null>
    save(data: Partial<AssetSchedule>, manager?: EntityManager): Promise<AssetSchedule>
    merge(entity: AssetSchedule, data: Partial<AssetSchedule>): AssetSchedule
    /** Replace the schedule's asset links with exactly `assetIds`. */
    setAssets(scheduleId: number, assetIds: number[], manager?: EntityManager): Promise<void>
    delete(id: number): Promise<void>
}
