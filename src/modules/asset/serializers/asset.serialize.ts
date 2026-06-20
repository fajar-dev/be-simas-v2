import { Asset } from "../entities/asset.entity"
import { minio } from "../../../core/helpers/minio"

interface DepreciationResult {
    method: string
    usefulLife: number | null
    residualValue: number | null
    startDate: string | null
    monthlyAmount: number | null
    monthsElapsed: number
    accumulated: number
    bookValue: number
    percentage: number
    isFullyDepreciated: boolean
}

export class AssetSerializer {
    private static async resolveImageUrl(image?: string | null): Promise<string | null> {
        if (!image) return null
        return await minio.getPresignedUrl(image)
    }

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

    private static getMonthsElapsed(startDate: string): number {
        const start = new Date(startDate)
        const now = new Date()
        const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
        // Include partial current month if past the start day
        const dayAdjust = now.getDate() >= start.getDate() ? 0 : -1
        return Math.max(0, months + dayAdjust)
    }

    private static calculateDepreciation(asset: Asset): DepreciationResult | null {
        if (!asset.depreciationMethod || asset.depreciationMethod === 'none') return null

        const price = asset.price ?? 0
        const residualValue = asset.residualValue ?? 0
        const usefulLife = asset.usefulLife ?? 0
        const startDate = asset.depreciationStartDate || asset.purchaseDate

        if (!startDate || price <= 0 || usefulLife <= 0) {
            return {
                method: asset.depreciationMethod,
                usefulLife: asset.usefulLife ?? null,
                residualValue: asset.residualValue ?? null,
                startDate: startDate || null,
                monthlyAmount: null,
                monthsElapsed: 0,
                accumulated: 0,
                bookValue: price,
                percentage: 0,
                isFullyDepreciated: false,
            }
        }

        const depreciableAmount = Math.max(0, price - residualValue)
        const monthsElapsed = this.getMonthsElapsed(startDate)

        let accumulated = 0
        let monthlyAmount = 0

        if (asset.depreciationMethod === 'straight_line') {
            monthlyAmount = Math.round(depreciableAmount / usefulLife)
            accumulated = Math.min(depreciableAmount, monthlyAmount * monthsElapsed)
        } else if (asset.depreciationMethod === 'declining_balance') {
            // Annual rate = 1 / (usefulLife in years)
            const usefulLifeYears = usefulLife / 12
            const annualRate = 1 / usefulLifeYears
            let bookValue = price

            // Calculate year by year up to current elapsed months
            const totalMonthsToCalc = Math.min(monthsElapsed, usefulLife)
            let remainingMonths = totalMonthsToCalc

            while (remainingMonths > 0 && bookValue > residualValue) {
                const monthsInPeriod = Math.min(12, remainingMonths)
                const yearDepreciation = Math.round(bookValue * annualRate)
                // Pro-rate if partial year
                const periodDepreciation = Math.round(yearDepreciation * (monthsInPeriod / 12))
                const cappedDepreciation = Math.min(periodDepreciation, bookValue - residualValue)

                if (cappedDepreciation <= 0) break

                accumulated += cappedDepreciation
                bookValue -= cappedDepreciation
                remainingMonths -= monthsInPeriod
            }

            // monthlyAmount = approximate current month's depreciation
            const currentBookValue = price - accumulated
            if (currentBookValue > residualValue) {
                monthlyAmount = Math.round((currentBookValue * annualRate) / 12)
            }
        }

        const bookValue = Math.max(residualValue, price - accumulated)
        const percentage = depreciableAmount > 0 ? Math.min(100, Math.round((accumulated / depreciableAmount) * 100)) : 0

        return {
            method: asset.depreciationMethod,
            usefulLife: asset.usefulLife ?? null,
            residualValue: asset.residualValue ?? null,
            startDate,
            monthlyAmount: monthlyAmount || null,
            monthsElapsed,
            accumulated,
            bookValue,
            percentage,
            isFullyDepreciated: percentage >= 100,
        }
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
            image: await this.resolveImageUrl(asset.image),
            hasHolder: asset.hasHolder,
            hasMaintenance: asset.hasMaintenance,
            hasLocation: asset.hasLocation,
            depreciationMethod: asset.depreciationMethod || 'none',
            usefulLife: asset.usefulLife ?? null,
            residualValue: asset.residualValue ?? null,
            depreciationStartDate: asset.depreciationStartDate || null,
            depreciation: this.calculateDepreciation(asset),
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
                photo: asset.createdBy.photo ? await minio.getPresignedUrl(asset.createdBy.photo) : null,
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
                    photo: asset.activeHolder.employee.photo ? await minio.getPresignedUrl(asset.activeHolder.employee.photo) : null,
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
