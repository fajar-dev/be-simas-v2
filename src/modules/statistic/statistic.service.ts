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

    async getAssetsBySubCategory() {
        const result = await AppDataSource.getRepository(Asset)
            .createQueryBuilder("asset")
            .innerJoin("asset.subCategory", "subCategory")
            .select("subCategory.name", "name")
            .addSelect("COUNT(asset.id)", "count")
            .addSelect("COALESCE(SUM(asset.price), 0)", "totalPrice")
            .groupBy("subCategory.id")
            .addGroupBy("subCategory.name")
            .orderBy("count", "DESC")
            .getRawMany()

        return result.map((row) => ({
            name: row.name,
            count: Number(row.count),
            totalPrice: Number(row.totalPrice),
        }))
    }

    async getAssetAging() {
        const assetRepo = AppDataSource.getRepository(Asset)
        const now = new Date()

        const twoYearsAgo = new Date(now)
        twoYearsAgo.setFullYear(now.getFullYear() - 2)
        const fiveYearsAgo = new Date(now)
        fiveYearsAgo.setFullYear(now.getFullYear() - 5)

        const fmt = (d: Date) => d.toISOString().split("T")[0]

        const [zeroToTwo, threeToFive, overFive] = await Promise.all([
            assetRepo.createQueryBuilder("asset")
                .where("asset.purchase_date >= :date", { date: fmt(twoYearsAgo) })
                .getCount(),
            assetRepo.createQueryBuilder("asset")
                .where("asset.purchase_date < :from AND asset.purchase_date >= :to", { from: fmt(twoYearsAgo), to: fmt(fiveYearsAgo) })
                .getCount(),
            assetRepo.createQueryBuilder("asset")
                .where("asset.purchase_date < :date", { date: fmt(fiveYearsAgo) })
                .getCount(),
        ])

        return [
            { label: "0-2 Years", count: zeroToTwo },
            { label: "3-5 Years", count: threeToFive },
            { label: ">5 Years", count: overFive },
        ]
    }

    async getDataQuality() {
        const assetRepo = AppDataSource.getRepository(Asset)

        const [withoutImage, withoutPrice, withoutBrand, withoutModel] = await Promise.all([
            assetRepo.createQueryBuilder("asset")
                .where("asset.image IS NULL OR asset.image = ''")
                .getCount(),
            assetRepo.createQueryBuilder("asset")
                .where("asset.price IS NULL OR asset.price = 0")
                .getCount(),
            assetRepo.createQueryBuilder("asset")
                .where("asset.brand IS NULL OR asset.brand = ''")
                .getCount(),
            assetRepo.createQueryBuilder("asset")
                .where("asset.model IS NULL OR asset.model = ''")
                .getCount(),
        ])

        return [
            { label: "Without Image", count: withoutImage },
            { label: "Without Price", count: withoutPrice },
            { label: "Without Brand", count: withoutBrand },
            { label: "Without Model", count: withoutModel },
        ]
    }
}
