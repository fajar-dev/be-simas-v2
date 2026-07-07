import { Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { PasswordResetToken } from "../entities/password-reset-token.entity"
import { IPasswordResetTokenRepository } from "../interfaces/password-reset-token.repository.interface"

export class PasswordResetTokenRepository implements IPasswordResetTokenRepository {
    private readonly repository: Repository<PasswordResetToken>

    constructor() {
        this.repository = AppDataSource.getRepository(PasswordResetToken)
    }

    async create(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken> {
        const resetToken = this.repository.create({ userId, token, expiresAt })
        return await this.repository.save(resetToken)
    }

    async findValidToken(token: string): Promise<PasswordResetToken | null> {
        return await this.repository.createQueryBuilder("prt")
            .innerJoinAndSelect("prt.user", "user")
            .where("prt.token = :token", { token })
            .andWhere("prt.expires_at > :now", { now: new Date() })
            .getOne()
    }

    async deleteAllByUserId(userId: number): Promise<void> {
        await this.repository.delete({ userId })
    }
}