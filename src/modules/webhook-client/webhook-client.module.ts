import { WebhookClientService } from "./webhook-client.service"
import { WebhookClientController } from "./webhook-client.controller"
import { assetService } from "../asset/asset.module"
import { locationService } from "../location/location.module"
import { assetLocationService } from "../asset-location/asset-location.module"
import { assetHandoverService } from "../asset-handover/asset-handover.module"

export const webhookClientService = new WebhookClientService(
    assetService,
    locationService,
    assetLocationService,
    assetHandoverService
)

export const webhookClientController = new WebhookClientController(webhookClientService)
