import { Context } from "hono"
import { HandoverFieldService } from "./handover-field.service"
import { HandoverFieldSerializer } from "./serializers/handover-field.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"
import { HANDOVER_TRANSACTION_TYPES, HandoverTransactionType } from "../../core/enums"

export class HandoverFieldController {
    constructor(private readonly service: HandoverFieldService) {}

    private parseType(raw: string | undefined): HandoverTransactionType {
        if (!raw || !(HANDOVER_TRANSACTION_TYPES as readonly string[]).includes(raw)) {
            throw new BadRequestException("transactionType must be one of: " + HANDOVER_TRANSACTION_TYPES.join(", "))
        }
        return raw as HandoverTransactionType
    }

    async index(c: Context) {
        const type = this.parseType(c.req.query("transactionType"))
        const fields = await this.service.getByType(type)
        return ApiResponse.success(c, HandoverFieldSerializer.collection(fields), "Handover fields retrieved successfully")
    }

    async replace(c: Context) {
        const type = this.parseType(c.req.param("transactionType"))
        const body = c.req.valid("json" as never) as any
        const fields = await this.service.replaceForType(type, body)
        return ApiResponse.success(c, HandoverFieldSerializer.collection(fields), "Handover fields saved successfully")
    }
}
