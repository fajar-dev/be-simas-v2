import { TypeOrmLocationRepository } from "./repositories/typeorm-location.repository"
import { LocationService } from "./location.service"
import { LocationController } from "./location.controller"

const locationRepository = new TypeOrmLocationRepository()
const locationService = new LocationService(locationRepository)

export const locationController = new LocationController(locationService)
