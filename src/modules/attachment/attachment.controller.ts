import { Context } from "hono"
import { AttachmentService } from "./attachment.service"
import { AttachmentSerializer } from "./serializers/attachment.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class AttachmentController {
    constructor(private readonly service: AttachmentService) {}

    async upload(c: Context) {
        const body = await c.req.parseBody()
        const file = body["file"]

        if (!file || !(file instanceof File)) {
            throw new BadRequestException("No file uploaded or invalid file")
        }

        const attachment = await this.service.upload(file)
        const data = await AttachmentSerializer.single(attachment)

        return ApiResponse.success(c, data, "File uploaded successfully", 201)
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        if (isNaN(id)) {
            throw new BadRequestException("Invalid attachment ID")
        }

        await this.service.delete(id)
        return ApiResponse.success(c, null, "Attachment deleted successfully")
    }
}
