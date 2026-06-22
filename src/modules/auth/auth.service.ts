import { User } from "../user/entities/user.entity"
import {
    RegisterValidator,
    LoginValidator,
    ForgotPasswordValidator,
    ResetPasswordValidator,
    RefreshTokenValidator,
    GoogleLoginValidator,
} from "./validators/auth.validator"
import { UnauthorizedException, BadRequestException } from "../../core/exceptions/base"
import { hashPassword, comparePassword } from "../../core/helpers/hash"
import { verify } from "hono/jwt"
import { config } from "../../config/config"
import crypto from "crypto"
import { mail } from "../../core/helpers/mail"
import { UserService } from "../user/user.service"
import { AuthHelper } from "../../core/helpers/auth"
import { minio } from "../../core/helpers/minio"

export class AuthService {
    constructor(
        private readonly userService: UserService,
    ) {}

    async register(data: RegisterValidator) {
        if (data.email) {
            const existing = await this.userService.getByEmail(data.email)
            if (existing) {
                throw new BadRequestException("Email already in use")
            }
        }

        // Transaction dikelola di repository layer (bukan service)
        return await this.userService.saveInTransaction({
            ...data,
            password: await hashPassword(data.password),
        })
    }

    async googleLogin(data: GoogleLoginValidator) {
        const payload = await AuthHelper.verifyGoogleCode(data.code)
        let user = await this.userService.getByEmailWithPassword(payload.email!)

        if (!user) {
            throw new BadRequestException("User not registered")
        }

        if (!user.isActive) {
            throw new BadRequestException("Account is inactive")
        }

        const { accessToken, refreshToken } = await AuthHelper.generateTokens(user)
        // Biarkan controller+serializer yang strip sensitive data
        return { user, accessToken, refreshToken }
    }

    async login(data: LoginValidator) {
        const user = await this.userService.getByEmailWithPassword(data.email)
        if (!user) {
            throw new UnauthorizedException("User not registered")
        }

        if (!user.isActive) {
            throw new UnauthorizedException("Account is inactive")
        }

        if (!user.password) {
            throw new UnauthorizedException("Invalid credentials")
        }

        const isValid = await comparePassword(data.password, user.password)
        if (!isValid) {
            throw new UnauthorizedException("Invalid credentials")
        }

        const { accessToken, refreshToken } = await AuthHelper.generateTokens(user)
        // Biarkan controller+serializer yang strip sensitive data
        return { user, accessToken, refreshToken }
    }

    async refreshToken(data: RefreshTokenValidator) {
        try {
            const decoded = await verify(data.refreshToken, config.app.jwtRefreshSecret, "HS256") as { sub: number }
            const user = await this.userService.getByIdWithPassword(decoded.sub)
            const { accessToken, refreshToken } = await AuthHelper.generateTokens(user)

            return { user, accessToken, refreshToken }
        } catch {
            throw new UnauthorizedException("Invalid or expired refresh token")
        }
    }

    async forgotPassword(data: ForgotPasswordValidator) {
        const user = await this.userService.getByEmail(data.email)
        if (!user) {
            throw new BadRequestException("Email not found")
        }

        if (!user.isActive) {
            throw new BadRequestException("Account is inactive")
        }

        const resetToken = crypto.randomBytes(32).toString("hex")
        user.resetPasswordToken = resetToken
        user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

        await this.userService.save(user)
        const resetLink = `${config.app.appUrl}/auth/reset-password?email=${user.email}&token=${resetToken}`
        const text = `Halo ${user.name},\n\nKami menerima permintaan untuk mengatur ulang kata sandi akun Anda.\n\nSilakan klik tautan berikut untuk mengatur ulang kata sandi:\n${resetLink}\n\nTautan ini akan kedaluwarsa dalam 30 menit.\n\nJika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini.\n\nTerima kasih.`
        mail.sendText(user.email, "Atur Ulang Kata Sandi", text).catch(err => console.error("[ForgotPassword] Failed to send email:", err))
        return true
    }

    async resetPassword(data: ResetPasswordValidator) {
        const user = await this.userService.getByResetToken(data.token)
        if (!user) {
            throw new BadRequestException("Invalid or expired reset token")
        }

        // Validate token has not expired
        if (!user.resetPasswordExpires || new Date() > new Date(user.resetPasswordExpires)) {
            user.resetPasswordToken = null as any
            user.resetPasswordExpires = null as any
            await this.userService.save(user)
            throw new BadRequestException("Reset token has expired")
        }

        user.password = await hashPassword(data.newPassword)
        user.resetPasswordToken = null as any
        user.resetPasswordExpires = null as any

        await this.userService.save(user)
        return true
    }

    async validateResetToken(email: string, token: string) {
        const user = await this.userService.getByEmailAndResetToken(email, token)
        if (!user) {
            throw new BadRequestException("Invalid or expired reset token")
        }

        // Validate token has not expired
        if (!user.resetPasswordExpires || new Date() > new Date(user.resetPasswordExpires)) {
            throw new BadRequestException("Reset token has expired")
        }

        return true
    }

    async logout(_user: User) {
        return true
    }

    async updateProfile(userId: number, data: { name: string; email: string; photo?: string | null }) {
        const user = await this.userService.getByIdWithPassword(userId)
        
        if (data.email && data.email !== user.email) {
            const existing = await this.userService.getByEmail(data.email)
            if (existing) {
                throw new BadRequestException("Email already in use")
            }
        }

        user.name = data.name
        user.email = data.email
        if (data.photo !== undefined) {
            user.photo = minio.sanitizePath(data.photo) ?? undefined
        }

        return await this.userService.save(user)
    }

    async updatePassword(userId: number, data: { oldPassword?: string; newPassword: string }) {
        const user = await this.userService.getByIdWithPassword(userId)
        
        if (user.password) {
            if (!data.oldPassword) {
                throw new BadRequestException("Old password is required")
            }
            const isValid = await comparePassword(data.oldPassword, user.password)
            if (!isValid) {
                throw new BadRequestException("Invalid old password")
            }
        }

        user.password = await hashPassword(data.newPassword)
        await this.userService.save(user)
        return true
    }
}
