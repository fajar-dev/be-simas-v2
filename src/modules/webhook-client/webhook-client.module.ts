import { WebhookClientService } from "./webhook-client.service"
import { WebhookClientController } from "./webhook-client.controller"
import { assetService } from "../asset/asset.module"
import { locationService } from "../location/location.module"
import { assetLocationService } from "../asset-location/asset-location.module"
import { handoverService } from "../handover/handover.module"

export const webhookClientService = new WebhookClientService(
    assetService,
    locationService,
    assetLocationService,
    handoverService
)

export const webhookClientController = new WebhookClientController(webhookClientService)
