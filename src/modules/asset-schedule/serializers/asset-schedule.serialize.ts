import { AssetSchedule } from "../entities/asset-schedule.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export type AssetScheduleWithAttachments = { schedule: AssetSchedule; attachments: Attachment[] }

export class AssetScheduleSerializer {
    private static async assets(schedule: AssetSchedule) {
        const links = schedule.scheduleAssets || []
        return await Promise.all(
            links
                .filter((l) => l.asset)
                .map(async (l) => ({
                    id: l.asset.id,
                    name: l.asset.name,
                    code: l.asset.code,
                    image: await resolveFileUrl(l.asset.image),
                }))
        )
    }

    static async single(schedule: AssetSchedule, attachments: Attachment[] = []) {
        return {
            id: schedule.id,
            title: schedule.title,
            description: schedule.description || null,
            startDate: schedule.startDate,
            startTime: schedule.startTime || null,
            endTime: schedule.endTime || null,
            recurrence: schedule.recurrence,
            daysOfWeek: schedule.daysOfWeek || null,
            dayOfMonth: schedule.dayOfMonth ?? null,
            month: schedule.month ?? null,
            recurrenceEndDate: schedule.recurrenceEndDate || null,
            assets: await this.assets(schedule),
            createdBy: schedule.createdBy
                ? {
                      id: schedule.createdBy.id,
                      name: schedule.createdBy.name,
                      photo: await resolveFileUrl(schedule.createdBy.photo),
                  }
                : null,
            attachments: await AttachmentSerializer.collection(attachments),
            createdAt: schedule.createdAt,
            updatedAt: schedule.updatedAt,
        }
    }

    static async collection(items: AssetScheduleWithAttachments[]) {
        return Promise.all(items.map((i) => this.single(i.schedule, i.attachments)))
    }

    /**
     * A single expanded occurrence for the calendar view: the schedule fields plus
     * the concrete `date` this instance falls on and whether it is a recurring copy.
     */
    static async occurrence(schedule: AssetSchedule, date: string, isRecurring: boolean) {
        const base = await this.single(schedule)
        return { ...base, date, isRecurring }
    }
}
