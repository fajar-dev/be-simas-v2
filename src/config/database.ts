import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "../modules/user/entities/user.entity"
import { Category } from "../modules/category/entities/category.entity"
import { SubCategory } from "../modules/sub-category/entities/sub-category.entity"
import { Employee } from "../modules/employee/entities/employee.entity"
import { Branch } from "../modules/branch/entities/branch.entity"
import { Location } from "../modules/location/entities/location.entity"
import { Asset } from "../modules/asset/entities/asset.entity"
import { AssetLabel } from "../modules/asset/entities/asset-label.entity"
import { Attachment } from "../modules/attachment/entities/attachment.entity"
import { AssetMaintenance } from "../modules/asset-maintenance/entities/asset-maintenance.entity"
import { AssetLocation } from "../modules/asset-location/entities/asset-location.entity"
import { AssetHolder } from "../modules/asset-holder/entities/asset-holder.entity"
import { AssetLog } from "../modules/asset-log/entities/asset-log.entity"
import { AssetStatus } from "../modules/asset-status/entities/asset-status.entity"
import { Role } from "../modules/role/entities/role.entity"
import { Permission } from "../modules/role/entities/permission.entity"
import { config } from "./config"

/**
 * TypeORM Database Configuration
 * 
 * Access via `AppDataSource` (default) atau `getDataSource()`.
 * Untuk testing, gunakan `setDataSource()` untuk override ke test database.
 */

const defaultDataSource = new DataSource({
    type: config.database.type,
    host: config.database.host,
    port: config.database.port,
    username: config.database.user,
    password: config.database.pass,
    database: config.database.name,
    synchronize: config.database.sync,
    entities: [User, Category, SubCategory, Employee, Branch, Location, Asset, AssetLabel, Attachment, AssetMaintenance, AssetLocation, AssetHolder, AssetLog, AssetStatus, Role, Permission],
    migrations: [],
    subscribers: [],
})

let activeDataSource: DataSource = defaultDataSource

/** Get the active DataSource (default or test-overridden) */
export function getDataSource(): DataSource {
    return activeDataSource
}

/** Override DataSource for testing */
export function setDataSource(ds: DataSource): void {
    activeDataSource = ds
}

/** Reset to default DataSource */
export function resetDataSource(): void {
    activeDataSource = defaultDataSource
}

/**
 * Backward-compatible export.
 * Modules yang sudah import `AppDataSource` tetap bekerja.
 * Proxy mendelegasikan semua akses ke activeDataSource.
 */
export const AppDataSource = new Proxy({} as DataSource, {
    get(_target, prop: string | symbol) {
        const value = (activeDataSource as any)[prop]
        // Bind methods ke DataSource asli agar `this` benar
        if (typeof value === "function") {
            return value.bind(activeDataSource)
        }
        return value
    },
})
