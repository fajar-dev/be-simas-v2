import { AppDataSource } from "../../config/database"
import { Asset } from "../asset/entities/asset.entity"
import { Category } from "../category/entities/category.entity"
import { SubCategory } from "../sub-category/entities/sub-category.entity"
import { Location } from "../location/entities/location.entity"
import { Branch } from "../branch/entities/branch.entity"

export class StatisticService {
    async getSummary() {
        const assetRepo = AppDataSource.getRepository(Asset)
        const categoryRepo = AppDataSource.getRepository(Category)
        const subCategoryRepo = AppDataSource.getRepository(SubCategory)
        const locationRepo = AppDataSource.getRepository(Location)
        const branchRepo = AppDataSource.getRepository(Branch)

        const [
            totalAssets,
            totalCategories,
            totalSubCategories,
            totalLocations,
            totalBranches,
            priceResult,
        ] = await Promise.all([
            assetRepo.count(),
            categoryRepo.count(),
            subCategoryRepo.count(),
            locationRepo.count(),
            branchRepo.count(),
            assetRepo
                .createQueryBuilder("asset")
                .select("COALESCE(SUM(asset.price), 0)", "totalPrice")
                .getRawOne(),
        ])

        return {
            totalAssets,
            totalPrice: Number(priceResult?.totalPrice || 0),
            totalCategories,
            totalSubCategories,
            totalLocations,
            totalBranches,
        }
    }
}
