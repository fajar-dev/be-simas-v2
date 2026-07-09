import { AssetService } from "../asset/asset.service"
import { LocationService } from "../location/location.service"
import { AssetLocationService } from "../asset-location/asset-location.service"
import { AssetHandoverService } from "../asset-handover/asset-handover.service"
import { config } from "../../config/config"

interface MistZoneEvent {
    site_id: string
    zone_id: string
    mac: string
    type: string // 'enter' or 'exit'
    timestamp: number
    name?: string
}

export class WebhookClientService {
    constructor(
        private readonly assetService: AssetService,
        private readonly locationService: LocationService,
        private readonly assetLocationService: AssetLocationService,
        private readonly assetHandoverService: AssetHandoverService
    ) {}

    // Mist Logic
    verifyMistSecret(secret: string): boolean {
        const expected = process.env.MIST_WEBHOOK_SECRET || config.mist.webhookSecret
        if (!expected) return true // No secret configured = allow all (dev mode)
        return secret === expected
    }

    async handleMistZoneEvent(event: MistZoneEvent): Promise<{ status: string; assetId?: number; locationId?: number }> {
        // Only process 'enter' events
        if (event.type !== 'enter') {
            return { status: 'skipped' }
        }

        // Normalize MAC: lowercase, colon-separated
        const mac = event.mac.toLowerCase().replace(/[^a-f0-9]/g, '').replace(/(.{2})(?=.)/g, '$1:')

        // Find asset by BLE tag MAC
        const asset = await this.assetService.findByBleTagMac(mac)
        if (!asset) {
            return { status: 'asset_not_found' }
        }

        // Check if asset has location tracking enabled
        if (!asset.hasLocation) {
            return { status: 'location_disabled' }
        }

        // Find location by Mist zone ID
        const location = await this.locationService.findByMistZoneId(event.zone_id)
        if (!location) {
            return { status: 'zone_not_mapped' }
        }

        // Check if asset is already at this location (prevent duplicate)
        const lastLocation = await this.assetLocationService.findLastLocation(asset.id)
        if (lastLocation && lastLocation.locationId === location.id) {
            return { status: 'already_at_location' }
        }

        // Create asset location record
        const date = new Date(event.timestamp * 1000).toISOString().slice(0, 16)
        try {
            await this.assetLocationService.create({
                assetId: asset.id,
                locationId: location.id,
                date,
                note: `Auto-detected via BLE (zone: ${event.name || event.zone_id})`,
                source: 'ble',
                createdByUserId: null,
            })
        } catch (err: any) {
            // If BadRequestException (already at location), just skip
            if (err?.statusCode === 400) {
                return { status: 'already_at_location' }
            }
            throw err
        }

        return { status: 'relocated', assetId: asset.id, locationId: location.id }
    }

    // Esign Logic
    async handleEsignEvent(body: any): Promise<any> {
        const externalReferenceId = Number(body.external_reference_id)
        if (isNaN(externalReferenceId)) {
            throw new Error("Invalid external reference ID")
        }

        const status = body.status
        if (status === "COMPLETED") {
            return await this.assetHandoverService.approve(externalReferenceId, body.file_url)
        } else {
            return await this.assetHandoverService.reject(externalReferenceId)
        }
    }
}
