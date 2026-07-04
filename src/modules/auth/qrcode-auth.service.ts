import { UnauthorizedException } from "../../core/exceptions/base"
import { UserService } from "../user/user.service"
import { AuthHelper } from "../../core/helpers/auth"

export class QrCodeAuthService {
    constructor(private readonly userService: UserService) {}

    /**
     * Generate QR Code from Panel server.
     */
    async generateQrCode() {
        const response = await AuthHelper.panelFetch("/api/companies/login/qrcode", {
            headers: { "Accept": "application/json" },
        })
        const body = await response.json()

        const token = AuthHelper.extractQrToken(body.qrcode_image)
        const qrCode = await AuthHelper.fetchQrCodeSvg(body.qrcode_image)

        return {
            token,
            qrCode,
            timeoutMinutes: body.time_out_in_minute || 1,
            expired: body.expired,
        }
    }

    /**
     * Check QR Code scan status from Panel.
     */
    async checkStatus(token: string) {
        const response = await AuthHelper.panelFetch(`/api/companies/login/qrcode/${token}`, {
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json",
            },
        })
        return response.json()
    }

    /**
     * Exchange Panel JWT token for a SIMAS session.
     */
    async exchangeToken(panelToken: string) {
        const email = AuthHelper.decodeEmailFromJwt(panelToken)

        const user = await this.userService.getByEmailWithPassword(email)
        if (!user) {
            throw new UnauthorizedException("User not registered")
        }

        if (!user.isActive) {
            throw new UnauthorizedException("Account is inactive")
        }

        const { accessToken, refreshToken } = await AuthHelper.generateTokens(user)
        return { user, accessToken, refreshToken }
    }
}
