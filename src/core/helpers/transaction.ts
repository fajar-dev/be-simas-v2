import { AppDataSource } from "../../config/database"
import { EntityManager } from "typeorm"

export async function withTransaction<T>(callback: (manager: EntityManager) => Promise<T>): Promise<T> {
    const queryRunner = AppDataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()
    try {
        const result = await callback(queryRunner.manager)
        await queryRunner.commitTransaction()
        return result
    } catch (err) {
        await queryRunner.rollbackTransaction()
        throw err
    } finally {
        await queryRunner.release()
    }
}
