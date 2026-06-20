import { LocationRepository } from "./repositories/location.repository"
import { LocationService } from "./location.service"
import { LocationController } from "./location.controller"

const locationRepository = new LocationRepository()
export const locationService = new LocationService(locationRepository)

export const locationController = new LocationController(locationService)
