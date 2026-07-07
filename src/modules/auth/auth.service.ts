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
import { UserService } from "../user/user.service"
import { AuthHelper } from "../../core/helpers/auth"
import { minio } from "../../core/helpers/minio"
import path from "path"
import fs from "fs"
import { Mail } from "../../core/helpers/mail"
import { IPasswordResetTokenRepository } from "./interfaces/password-reset-token.repository.interface"

export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly mailHelper: Mail,
        private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,


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
        const expiresAt = new Date(Date.now() + 36000000) // 10 hours

        await this.passwordResetTokenRepository.create(user.id, resetToken, expiresAt)

        await this.userService.save(user)
        const resetLink = `${config.app.appUrl}/auth/reset-password?token=${resetToken}`
        const templatePath = path.join(process.cwd(), "public/templates/forgot-password.html")
        const html = fs.readFileSync(templatePath, "utf8")
            .replace(/{{name}}/g, user.name!)
            .replace(/{{resetLink}}/g, resetLink)

        this.mailHelper.sendHtml(user.email!, "Atur Ulang Kata Sandi", html).catch((err: any) => {
            console.error(`[Mail] Failed to send reset password email to ${user.email}:`, err)
        })
        return true
    }

    async resetPassword(data: ResetPasswordValidator) {
         const resetToken = await this.passwordResetTokenRepository.findValidToken(data.token)
        if (!resetToken) {
            throw new BadRequestException("Invalid or expired reset token")
        }

        const user = resetToken.user
        user.password = await hashPassword(data.newPassword)

        await this.userService.save(user)
        await this.passwordResetTokenRepository.deleteAllByUserId(user.id)

        return true
    }

    async validateResetToken(token: string) {
        const resetToken = await this.passwordResetTokenRepository.findValidToken(token)
        if (!resetToken) {
            throw new BadRequestException("Invalid or expired reset token")
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
