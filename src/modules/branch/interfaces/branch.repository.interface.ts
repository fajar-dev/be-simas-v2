import { EntityManager } from "typeorm"
import { Branch } from "../entities/branch.entity"

export interface IBranchRepository {
    findAll(page: number, limit: number, q: string): Promise<{ data: Branch[]; total: number }>
    findById(id: number): Promise<Branch | null>
    save(data: Partial<Branch>, manager?: EntityManager): Promise<Branch>
    merge(entity: Branch, data: Partial<Branch>): Branch
    delete(id: number): Promise<void>
}
