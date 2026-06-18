import { Location } from "../entities/location.entity"

export class LocationSerializer {
    static single(location: Location) {
        return {
            id: location.id,
            name: location.name,
            description: location.description || null,
            branchId: location.branchId,
            branch: location.branch ? {
                id: location.branch.id,
                code: location.branch.code,
                name: location.branch.name,
            } : null,
            createdAt: location.createdAt,
            updatedAt: location.updatedAt,
        }
    }

    static collection(locations: Location[]) {
        return locations.map(loc => this.single(loc))
    }
}
