import { Context } from "hono"
import { AiService } from "./ai.service"
import { AiSerializer } from "./serializers/ai.serializer"
import { ApiResponse } from "../../core/helpers/response"

export class AiController {
    constructor(private readonly service: AiService) {}

    async decodeBarcode(c: Context) {
        const { image } = c.req.valid("form" as never) as { image: File }

        const result = await this.service.decodeBarcode(image)
        const data = AiSerializer.decodeResult(result)

        return ApiResponse.success(c, data, "Barcode/QR code decoded successfully")
    }
}
