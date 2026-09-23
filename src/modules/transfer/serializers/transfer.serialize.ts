import { Transfer } from "../entities/transfer.entity"

export class TransferSerializer {
    static single(transfer: Transfer) {
        return {
            id: transfer.id,
            name: transfer.name,
            price: transfer.price ?? null,
            code: transfer.code || [],
            quantity: transfer.quantity,
            purchaseDate: transfer.purchaseDate || null,
            createdBy: transfer.createdBy || null,
            status: transfer.status,
            mergedAssets: transfer.mergedAssets || [],
            createdAt: transfer.createdAt,
            updatedAt: transfer.updatedAt,
        }
    }

    static collection(items: Transfer[]) {
        return items.map((item) => this.single(item))
    }
}
