import { EntityManager } from "typeorm"
import { Location } from "../entities/location.entity"

export interface ILocationRepository {
    findAll(page: number, limit: number, q: string): Promise<{ data: Location[]; total: number }>
    findById(id: number): Promise<Location | null>
    save(data: Partial<Location>, manager?: EntityManager): Promise<Location>
    merge(entity: Location, data: Partial<Location>): Location
    delete(id: number): Promise<void>
}
