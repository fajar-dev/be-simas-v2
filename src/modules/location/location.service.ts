import { Location } from "./entities/location.entity"
import { NotFoundException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { ILocationRepository } from "./interfaces/location.repository.interface"

export class LocationService {
    constructor(private readonly repository: ILocationRepository) {}

    async getAll(page: number, limit: number, q: string): Promise<{ data: Location[]; total: number }> {
        return await this.repository.findAll(page, limit, q)
    }

    async getById(id: number): Promise<Location> {
        const location = await this.repository.findById(id)
        if (!location) {
            throw new NotFoundException("Location not found")
        }
        return location
    }

    async create(data: Partial<Location>): Promise<Location> {
        return await this.repository.save(data)
    }

    async update(id: number, data: Partial<Location>): Promise<Location> {
        const location = await this.getById(id)
        this.repository.merge(location, data)
        return await this.repository.save(location)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        await this.repository.delete(id)
    }

    async save(data: Partial<Location>, manager?: EntityManager): Promise<Location> {
        return await this.repository.save(data, manager)
    }
}
