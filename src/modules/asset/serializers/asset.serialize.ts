import { Asset } from "../entities/asset.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class AssetSerializer {

    private static calculateAge(purchaseDate?: string | null): string | null {
        if (!purchaseDate) return null
        const start = new Date(purchaseDate)
        const now = new Date()

        let years = now.getFullYear() - start.getFullYear()
        let months = now.getMonth() - start.getMonth()
        let days = now.getDate() - start.getDate()

        if (days < 0) {
            months--
            const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
            days += prevMonth.getDate()
        }
        if (months < 0) {
            years--
            months += 12
        }

        const parts: string[] = []
        if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`)
        if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`)
        if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`)

        return parts.length > 0 ? parts.join(' ') : '0 days'
    }

    static async single(asset: Asset) {
        return {
            id: asset.id,
            code: asset.code,
            name: asset.name,
            description: asset.description || null,
            price: asset.price ?? null,
            purchaseDate: asset.purchaseDate || null,
            age: this.calculateAge(asset.purchaseDate),
            brand: asset.brand || null,
            model: asset.model || null,
            image: await resolveFileUrl(asset.image),
            hasHolder: asset.hasHolder,
            hasMaintenance: asset.hasMaintenance,
            hasLocation: asset.hasLocation,
            subCategory: asset.subCategory ? {
                id: asset.subCategory.id,
                name: asset.subCategory.name,
                category: asset.subCategory.category ? {
                    id: asset.subCategory.category.id,
                    name: asset.subCategory.category.name,
                } : null,
            } : null,
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt,
            createdBy: asset.createdBy ? {
                id: asset.createdBy.id,
                name: asset.createdBy.name,
                photo: await resolveFileUrl(asset.createdBy.photo),
            } : null,
            labels: (asset.labels || []).map(l => ({
                id: l.id,
                key: l.key,
                value: l.value,
            })),
            activeHolder: asset.activeHolder ? {
                id: asset.activeHolder.id,
                employeeId: asset.activeHolder.employeeId,
                assignedDate: asset.activeHolder.assignedDate,
                employee: asset.activeHolder.employee ? {
                    id: asset.activeHolder.employee.id,
                    name: asset.activeHolder.employee.name,
                    employeeId: asset.activeHolder.employee.employeeId,
                    jobPosition: asset.activeHolder.employee.jobPosition,
                    photo: await resolveFileUrl(asset.activeHolder.employee.photo),
                } : null,
            } : null,
            lastLocation: asset.lastLocation ? {
                id: asset.lastLocation.id,
                date: asset.lastLocation.date,
                location: asset.lastLocation.location ? {
                    id: asset.lastLocation.location.id,
                    name: asset.lastLocation.location.name,
                    branch: asset.lastLocation.location.branch ? {
                        id: asset.lastLocation.location.branch.id,
                        name: asset.lastLocation.location.branch.name,
                    } : null,
                } : null,
            } : null,
            lastStatus: asset.lastStatus ? {
                id: asset.lastStatus.id,
                status: asset.lastStatus.status,
                note: asset.lastStatus.note || null,
                createdAt: asset.lastStatus.createdAt,
            } : null,
        }
    }

    static async collection(assets: Asset[]) {
        return Promise.all(assets.map(asset => this.single(asset)))
    }
}
