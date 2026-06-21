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

    async getAssetsByCategory() {
        const result = await AppDataSource.getRepository(Asset)
            .createQueryBuilder("asset")
            .innerJoin("asset.subCategory", "subCategory")
            .innerJoin("subCategory.category", "category")
            .select("category.name", "name")
            .addSelect("COUNT(asset.id)", "count")
            .addSelect("COALESCE(SUM(asset.price), 0)", "totalPrice")
            .groupBy("category.id")
            .addGroupBy("category.name")
            .getRawMany()

        return result.map((row) => ({
            name: row.name,
            count: Number(row.count),
            totalPrice: Number(row.totalPrice),
        }))
    }

    async getAssetsByLocation() {
        const result = await AppDataSource.getRepository(Asset)
            .createQueryBuilder("asset")
            .innerJoin(
                (qb) =>
                    qb
                        .select("al.asset_id", "asset_id")
                        .addSelect("al.location_id", "location_id")
                        .from("asset_locations", "al")
                        .innerJoin(
                            (sub) =>
                                sub
                                    .select("asset_id")
                                    .addSelect("MAX(id)", "max_id")
                                    .from("asset_locations", "al2")
                                    .groupBy("asset_id"),
                            "latest",
                            "al.id = latest.max_id",
                        ),
                "current_loc",
                "asset.id = current_loc.asset_id",
            )
            .innerJoin(Location, "location", "location.id = current_loc.location_id")
            .select("location.name", "name")
            .addSelect("COUNT(asset.id)", "count")
            .addSelect("COALESCE(SUM(asset.price), 0)", "totalPrice")
            .groupBy("location.id")
            .addGroupBy("location.name")
            .getRawMany()

        return result.map((row) => ({
            name: row.name,
            count: Number(row.count),
            totalPrice: Number(row.totalPrice),
        }))
    }
}
