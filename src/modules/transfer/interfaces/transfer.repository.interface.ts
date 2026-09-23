import { EntityManager } from "typeorm"
import { Transfer } from "../entities/transfer.entity"

export interface TransferFilter {
    status?: string
}

export interface ITransferRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: "ASC" | "DESC",
        filters?: TransferFilter
    ): Promise<{ data: Transfer[]; total: number }>
    findById(id: number): Promise<Transfer | null>
    save(data: Partial<Transfer>, manager?: EntityManager): Promise<Transfer>
    merge(entity: Transfer, data: Partial<Transfer>): Transfer
}
