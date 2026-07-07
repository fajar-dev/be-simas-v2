import { Context } from "hono"
import { AuthService } from "./auth.service"
import { QrCodeAuthService } from "./qrcode-auth.service"
import { ApiResponse } from "../../core/helpers/response"
import { AuthSerializer } from "./serializers/auth.serialize"
import { QrCodeAuthSerializer } from "./serializers/qrcode-auth.serialize"
import { BadRequestException } from "../../core/exceptions/base"

export class AuthController {
    constructor(
        private readonly service: AuthService,
        private readonly qrCodeService: QrCodeAuthService,
    ) {}

    async register(c: Context) {
        const body = c.req.valid("json" as never)
        const user = await this.service.register(body)
        const serialized = await AuthSerializer.single(user)
        return ApiResponse.success(c, serialized, "User registered successfully", 201)
    }

    async login(c: Context) {
        const body = c.req.valid("json" as never)
        const data = await this.service.login(body)
        const serializedUser = await AuthSerializer.single(data.user)
        return ApiResponse.success(c, {
            user: serializedUser,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
        }, "Logged in successfully")
    }

    async google(c: Context) {
        const body = c.req.valid("json" as never)
        const data = await this.service.googleLogin(body)
        const serializedUser = await AuthSerializer.single(data.user)
        return ApiResponse.success(c, {
            user: serializedUser,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken
        }, 'Logged in successfully')
    }

    async refreshToken(c: Context) {
        const body = c.req.valid("json" as never)
        const tokens = await this.service.refreshToken(body)
        const serializedUser = await AuthSerializer.single(tokens.user)
        return ApiResponse.success(c, {
            user: serializedUser,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        }, "Token refreshed successfully")
    }

    async me(c: Context) {
        const user = c.get("user")
        const serialized = await AuthSerializer.single(user)
        return ApiResponse.success(c, serialized, "User profile retrieved successfully")
    }

    async logout(c: Context) {
        const user = c.get("user")
        await this.service.logout(user)
        return ApiResponse.success(c, null, "Logged out successfully")
    }

    async forgotPassword(c: Context) {
        const body = c.req.valid("json" as never)
        await this.service.forgotPassword(body)
        return ApiResponse.success(c, null, "Password reset instructions have been sent to your email")
    }

    async validateResetToken(c: Context) {
        const token = c.req.query("token")
        if (!token) throw new BadRequestException("Reset token is required")
        await this.service.validateResetToken(token)
        return ApiResponse.success(c, null, "Token is valid")
    }

    async resetPassword(c: Context) {
        const body = c.req.valid("json" as never)
        await this.service.resetPassword(body)
        return ApiResponse.success(c, null, "Password has been successfully reset")
    }

    async updateProfile(c: Context) {
        const user = c.get("user")
        const body = c.req.valid("json" as never)
        const updatedUser = await this.service.updateProfile(user.id, body)
        const serialized = await AuthSerializer.single(updatedUser)
        return ApiResponse.success(c, serialized, "Profile updated successfully")
    }

    async updatePassword(c: Context) {
        const user = c.get("user")
        const body = c.req.valid("json" as never)
        await this.service.updatePassword(user.id, body)
        return ApiResponse.success(c, null, "Password updated successfully")
    }

    // ── QR Code Login ────────────────────────────────────────────────────

    async generateQrCode(c: Context) {
        const data = await this.qrCodeService.generateQrCode()
        return ApiResponse.success(c, QrCodeAuthSerializer.generate(data), "QR Code generated successfully")
    }

    async qrCodeStatus(c: Context) {
        const token = c.req.param("token")
        if (!token) throw new BadRequestException("QR Code token is required")

        const body = await this.qrCodeService.checkStatus(token)
        const data = QrCodeAuthSerializer.status(body)

        return ApiResponse.success(c, data, body.message || "OK")
    }

    async qrCodeLogin(c: Context) {
        const body = await c.req.json()
        if (!body.panelToken) throw new BadRequestException("Panel token is required")

        const data = await this.qrCodeService.exchangeToken(body.panelToken)
        const serializedUser = await AuthSerializer.single(data.user)
        return ApiResponse.success(c, {
            user: serializedUser,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
        }, "Logged in successfully via QR Code")
    }
}
