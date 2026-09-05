import { AssetHolder } from "../../asset-holder/entities/asset-holder.entity"

export interface BookLoanFilters {
    search?: string
    startDate?: string
    endDate?: string
    hasReturn?: boolean
}

export interface IBookRepository {
    findLoans(filters: BookLoanFilters): Promise<AssetHolder[]>
    findActiveLoans(employeeId: number): Promise<AssetHolder[]>
}
