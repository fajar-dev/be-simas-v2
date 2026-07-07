import { PasswordResetToken } from "../entities/password-reset-token.entity"

export interface IPasswordResetTokenRepository {
    create(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken>
    findValidToken(token: string): Promise<PasswordResetToken | null>
    deleteAllByUserId(userId: number): Promise<void>
}