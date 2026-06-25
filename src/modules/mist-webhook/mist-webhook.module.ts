import { MistWebhookService } from "./mist-webhook.service"
import { MistWebhookController } from "./mist-webhook.controller"
import { assetService } from "../asset/asset.module"
import { locationService } from "../location/location.module"
import { assetLocationService } from "../asset-location/asset-location.module"

export const mistWebhookService = new MistWebhookService(assetService, locationService, assetLocationService)
export const mistWebhookController = new MistWebhookController(mistWebhookService)
