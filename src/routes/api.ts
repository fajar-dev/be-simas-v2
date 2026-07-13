import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import crypto from "crypto"

// ── Validators ──────────────────────────────────────────────────────────────
import { RegisterValidator, LoginValidator, ForgotPasswordValidator, ResetPasswordValidator, RefreshTokenValidator, GoogleLoginValidator, UpdateProfileValidator, UpdatePasswordValidator } from "../modules/auth/validators/auth.validator"
import { CreateUserValidator, UpdateUserValidator } from "../modules/user/validators/user.validator"
import { CreateCategoryValidator, UpdateCategoryValidator } from "../modules/category/validators/category.validator"
import { CreateSubCategoryValidator, UpdateSubCategoryValidator } from "../modules/sub-category/validators/sub-category.validator"
import { CreateEmployeeValidator, UpdateEmployeeValidator } from "../modules/employee/validators/employee.validator"
import { CreateBranchValidator, UpdateBranchValidator } from "../modules/branch/validators/branch.validator"
import { CreateLocationValidator, UpdateLocationValidator } from "../modules/location/validators/location.validator"
import { CreateAssetValidator, UpdateAssetValidator, BulkDeleteAssetValidator } from "../modules/asset/validators/asset.validator"
import { CreateAssetMaintenanceValidator, UpdateAssetMaintenanceValidator } from "../modules/asset-maintenance/validators/asset-maintenance.validator"
import { CreateAssetNoteValidator, UpdateAssetNoteValidator } from "../modules/asset-note/validators/asset-note.validator"
import { CreateAssetLocationValidator } from "../modules/asset-location/validators/asset-location.validator"
import { AssignAssetValidator, ReturnAssetValidator } from "../modules/asset-holder/validators/asset-holder.validator"
import { StoreFeedbackValidator } from "../modules/feedback/validators/feedback.validator"
import { CreateAssetStatusValidator, BulkCreateAssetStatusValidator } from "../modules/asset-status/validators/asset-status.validator"
import { CreateRoleValidator, UpdateRoleValidator } from "../modules/role/validators/role.validator"
import { DecodeBarcodeValidator } from "../modules/ai/validators/ai.validator"
import { CreateHandoverValidator } from "../modules/handover/validators/handover.validator"
import { ReplaceHandoverFieldsValidator } from "../modules/handover-field/validators/handover-field.validator"
import { CreateInventoryValidator, UpdateInventoryValidator } from "../modules/inventory/validators/inventory.validator"
import { CreateInventoryVariantValidator, UpdateInventoryVariantValidator } from "../modules/inventory-variant/validators/inventory-variant.validator"
import { InventoryStockEntryValidator, InventoryStockTransferValidator, InventoryStockAssignValidator, InventoryStockReturnValidator } from "../modules/inventory-stock/validators/inventory-stock.validator"

// ── Middlewares ──────────────────────────────────────────────────────────────
import { authMiddleware } from "../core/middlewares/auth.middleware"
import { validationHook } from "../core/helpers/validator"
import { BadRequestException } from "../core/exceptions/base"
import { requirePermission } from "../core/middlewares/permission.middleware"

// ── Modules (controllers wired with their dependencies) ──────────────────────
import { authController } from "../modules/auth/auth.module"
import { userController } from "../modules/user/user.module"
import { categoryController } from "../modules/category/category.module"
import { subCategoryController } from "../modules/sub-category/sub-category.module"
import { feedbackController } from "../modules/feedback/feedback.module"
import { employeeController } from "../modules/employee/employee.module"
import { branchController } from "../modules/branch/branch.module"
import { locationController } from "../modules/location/location.module"
import { assetController } from "../modules/asset/asset.module"
import { attachmentController } from "../modules/attachment/attachment.module"
import { assetMaintenanceController } from "../modules/asset-maintenance/asset-maintenance.module"
import { assetNoteController } from "../modules/asset-note/asset-note.module"
import { assetLocationController } from "../modules/asset-location/asset-location.module"
import { assetHolderController } from "../modules/asset-holder/asset-holder.module"
import { assetLogController } from "../modules/asset-log/asset-log.module"
import { assetStatusController } from "../modules/asset-status/asset-status.module"
import { statisticController } from "../modules/statistic/statistic.module"
import { roleController } from "../modules/role/role.module"
import { webhookClientController } from "../modules/webhook-client/webhook-client.module"
import { aiController } from "../modules/ai/ai.module"
import { bookController } from "../modules/book/book.module"
import { BorrowBookValidator, ReturnBookValidator } from "../modules/book/validators/book.validator"
import { handoverController } from "../modules/handover/handover.module"
import { handoverFieldController } from "../modules/handover-field/handover-field.module"
import { inventoryController } from "../modules/inventory/inventory.module"
import { inventoryVariantController } from "../modules/inventory-variant/inventory-variant.module"
import { inventoryStockController } from "../modules/inventory-stock/inventory-stock.module"
import { apiKeyMiddleware } from "../core/middlewares/api-key.middleware"

// ── Routes ───────────────────────────────────────────────────────────────────
const routes = new Hono()

// Auth
routes.post("/auth/register", zValidator("json", RegisterValidator, validationHook), (c) => authController.register(c))
routes.post("/auth/login", zValidator("json", LoginValidator, validationHook), (c) => authController.login(c))
routes.post("/auth/google", zValidator("json", GoogleLoginValidator, validationHook), (c) => authController.google(c))
routes.post("/auth/forgot-password", zValidator("json", ForgotPasswordValidator, validationHook), (c) => authController.forgotPassword(c))
routes.get("/auth/validate-reset-token", (c) => authController.validateResetToken(c))
routes.post("/auth/reset-password", zValidator("json", ResetPasswordValidator, validationHook), (c) => authController.resetPassword(c))
routes.post("/auth/refresh", zValidator("json", RefreshTokenValidator, validationHook), (c) => authController.refreshToken(c))
routes.get("/auth/me", authMiddleware, (c) => authController.me(c))
routes.put("/auth/profile", authMiddleware, zValidator("json", UpdateProfileValidator, validationHook), (c) => authController.updateProfile(c))
routes.put("/auth/password", authMiddleware, zValidator("json", UpdatePasswordValidator, validationHook), (c) => authController.updatePassword(c))
routes.post("/auth/logout", authMiddleware, (c) => authController.logout(c))

// Auth - QR Code Login (public, no auth required)
routes.get("/auth/qrcode/generate", (c) => authController.generateQrCode(c))
routes.get("/auth/qrcode/:token/status", (c) => authController.qrCodeStatus(c))
routes.post("/auth/qrcode/login", (c) => authController.qrCodeLogin(c))

// User
routes.get("/user", authMiddleware, requirePermission("user:read"), (c) => userController.index(c))
routes.get("/user/:id", authMiddleware, requirePermission("user:read"), (c) => userController.show(c))
routes.post("/user", authMiddleware, requirePermission("user:create"), zValidator("json", CreateUserValidator, validationHook), (c) => userController.store(c))
routes.put("/user/:id", authMiddleware, requirePermission("user:update"), zValidator("json", UpdateUserValidator, validationHook), (c) => userController.update(c))
routes.delete("/user/:id", authMiddleware, requirePermission("user:delete"), (c) => userController.destroy(c))

// Category
routes.get("/category/list", authMiddleware, (c) => categoryController.list(c))
routes.get("/category", authMiddleware, requirePermission("category:read"), (c) => categoryController.index(c))
routes.get("/category/:id", authMiddleware, requirePermission("category:read"), (c) => categoryController.show(c))
routes.post("/category", authMiddleware, requirePermission("category:create"), zValidator("json", CreateCategoryValidator, validationHook), (c) => categoryController.store(c))
routes.put("/category/:id", authMiddleware, requirePermission("category:update"), zValidator("json", UpdateCategoryValidator, validationHook), (c) => categoryController.update(c))
routes.delete("/category/:id", authMiddleware, requirePermission("category:delete"), (c) => categoryController.destroy(c))

// Sub Category
routes.get("/sub-category", authMiddleware, requirePermission("sub-category:read"), (c) => subCategoryController.index(c))
routes.get("/sub-category/by-category/:categoryId", authMiddleware, (c) => subCategoryController.byCategory(c))
routes.get("/sub-category/:id", authMiddleware, requirePermission("sub-category:read"), (c) => subCategoryController.show(c))
routes.post("/sub-category", authMiddleware, requirePermission("sub-category:create"), zValidator("json", CreateSubCategoryValidator, validationHook), (c) => subCategoryController.store(c))
routes.put("/sub-category/:id", authMiddleware, requirePermission("sub-category:update"), zValidator("json", UpdateSubCategoryValidator, validationHook), (c) => subCategoryController.update(c))
routes.delete("/sub-category/:id", authMiddleware, requirePermission("sub-category:delete"), (c) => subCategoryController.destroy(c))

// Feedback
routes.get("/feedback", authMiddleware, (c) => feedbackController.index(c))
routes.post("/feedback", authMiddleware, zValidator("form", StoreFeedbackValidator, validationHook), (c) => feedbackController.store(c))

// Employee
routes.get("/employee/list", authMiddleware, (c) => employeeController.list(c))
routes.get("/employee", authMiddleware, requirePermission("employee:read"), (c) => employeeController.index(c))
routes.get("/employee/:id", authMiddleware, requirePermission("employee:read"), (c) => employeeController.show(c))
routes.post("/employee", authMiddleware, requirePermission("employee:create"), zValidator("json", CreateEmployeeValidator, validationHook), (c) => employeeController.store(c))
routes.put("/employee/:id", authMiddleware, requirePermission("employee:update"), zValidator("json", UpdateEmployeeValidator, validationHook), (c) => employeeController.update(c))
routes.delete("/employee/:id", authMiddleware, requirePermission("employee:delete"), (c) => employeeController.destroy(c))

// Branch
routes.get("/branch/list", authMiddleware, (c) => branchController.list(c))
routes.get("/branch", authMiddleware, requirePermission("branch:read"), (c) => branchController.index(c))
routes.get("/branch/:id", authMiddleware, requirePermission("branch:read"), (c) => branchController.show(c))
routes.post("/branch", authMiddleware, requirePermission("branch:create"), zValidator("json", CreateBranchValidator, validationHook), (c) => branchController.store(c))
routes.put("/branch/:id", authMiddleware, requirePermission("branch:update"), zValidator("json", UpdateBranchValidator, validationHook), (c) => branchController.update(c))
routes.delete("/branch/:id", authMiddleware, requirePermission("branch:delete"), (c) => branchController.destroy(c))

// Location
routes.get("/location", authMiddleware, requirePermission("location:read"), (c) => locationController.index(c))
routes.get("/location/by-branch/:branchId", authMiddleware, (c) => locationController.byBranch(c))
routes.get("/location/:id", authMiddleware, requirePermission("location:read"), (c) => locationController.show(c))
routes.post("/location", authMiddleware, requirePermission("location:create"), zValidator("json", CreateLocationValidator, validationHook), (c) => locationController.store(c))
routes.put("/location/:id", authMiddleware, requirePermission("location:update"), zValidator("json", UpdateLocationValidator, validationHook), (c) => locationController.update(c))
routes.delete("/location/:id", authMiddleware, requirePermission("location:delete"), (c) => locationController.destroy(c))

// Asset
routes.get("/asset", authMiddleware, requirePermission("asset:read"), (c) => assetController.index(c))
routes.get("/asset/check-code", authMiddleware, (c) => assetController.checkCode(c))
routes.get("/asset/label-keys", authMiddleware, (c) => assetController.getLabelKeys(c))
routes.get("/asset/export", authMiddleware, requirePermission("asset:export"), (c) => assetController.export(c))
routes.get("/asset/import-template", authMiddleware, requirePermission("asset:import"), (c) => assetController.importTemplate(c))
routes.post("/asset/import", authMiddleware, requirePermission("asset:import"), (c) => assetController.import(c))
routes.get("/asset/:id", authMiddleware, requirePermission("asset:read"), (c) => assetController.show(c))
routes.post("/asset", authMiddleware, requirePermission("asset:create"), zValidator("json", CreateAssetValidator, validationHook), (c) => assetController.store(c))
routes.put("/asset/:id", authMiddleware, requirePermission("asset:update"), zValidator("json", UpdateAssetValidator, validationHook), (c) => assetController.update(c))
routes.post("/asset/bulk-delete", authMiddleware, requirePermission("asset:delete"), zValidator("json", BulkDeleteAssetValidator, validationHook), (c) => assetController.bulkDestroy(c))
routes.delete("/asset/:id", authMiddleware, requirePermission("asset:delete"), (c) => assetController.destroy(c))

// Attachment
routes.post("/attachment", authMiddleware, (c) => attachmentController.upload(c))
routes.delete("/attachment/:id", authMiddleware, (c) => attachmentController.destroy(c))

// Asset Maintenance
routes.get("/asset-maintenance", authMiddleware, requirePermission("asset-maintenance:read"), (c) => assetMaintenanceController.index(c))
routes.get("/asset-maintenance/label-keys", authMiddleware, requirePermission("asset-maintenance:read"), (c) => assetMaintenanceController.getLabelKeys(c))
routes.get("/asset-maintenance/:id", authMiddleware, requirePermission("asset-maintenance:read"), (c) => assetMaintenanceController.show(c))
routes.post("/asset-maintenance", authMiddleware, requirePermission("asset-maintenance:create"), zValidator("json", CreateAssetMaintenanceValidator, validationHook), (c) => assetMaintenanceController.store(c))
routes.put("/asset-maintenance/:id", authMiddleware, requirePermission("asset-maintenance:update"), zValidator("json", UpdateAssetMaintenanceValidator, validationHook), (c) => assetMaintenanceController.update(c))
routes.delete("/asset-maintenance/:id", authMiddleware, requirePermission("asset-maintenance:delete"), (c) => assetMaintenanceController.destroy(c))

// Asset Note
routes.get("/asset-note", authMiddleware, requirePermission("asset-note:read"), (c) => assetNoteController.index(c))
routes.get("/asset-note/label-keys", authMiddleware, requirePermission("asset-note:read"), (c) => assetNoteController.getLabelKeys(c))
routes.get("/asset-note/:id", authMiddleware, requirePermission("asset-note:read"), (c) => assetNoteController.show(c))
routes.post("/asset-note", authMiddleware, requirePermission("asset-note:create"), zValidator("json", CreateAssetNoteValidator, validationHook), (c) => assetNoteController.store(c))
routes.put("/asset-note/:id", authMiddleware, requirePermission("asset-note:update"), zValidator("json", UpdateAssetNoteValidator, validationHook), (c) => assetNoteController.update(c))
routes.delete("/asset-note/:id", authMiddleware, requirePermission("asset-note:delete"), (c) => assetNoteController.destroy(c))

// Asset Location
routes.get("/asset-location", authMiddleware, requirePermission("asset-location:read"), (c) => assetLocationController.index(c))
routes.get("/asset-location/:id", authMiddleware, requirePermission("asset-location:read"), (c) => assetLocationController.show(c))
routes.post("/asset-location", authMiddleware, requirePermission("asset-location:create"), zValidator("json", CreateAssetLocationValidator, validationHook), (c) => assetLocationController.store(c))

// Asset Holder
routes.get("/asset-holder", authMiddleware, requirePermission("asset-holder:read"), (c) => assetHolderController.index(c))
routes.get("/asset-holder/active/:assetId", authMiddleware, requirePermission("asset-holder:read"), (c) => assetHolderController.active(c))
routes.get("/asset-holder/:id", authMiddleware, requirePermission("asset-holder:read"), (c) => assetHolderController.show(c))
routes.post("/asset-holder", authMiddleware, requirePermission("asset-holder:create"), zValidator("json", AssignAssetValidator, validationHook), (c) => assetHolderController.store(c))
routes.post("/asset-holder/:id/return", authMiddleware, requirePermission("asset-holder:return"), zValidator("json", ReturnAssetValidator, validationHook), (c) => assetHolderController.returnAsset(c))

// Asset Log
routes.get("/asset-log", authMiddleware, requirePermission("asset:read"), (c) => assetLogController.index(c))

// Asset Status
routes.get("/asset-status", authMiddleware, requirePermission("asset-status:read"), (c) => assetStatusController.index(c))
routes.post("/asset-status/bulk", authMiddleware, requirePermission("asset-status:create"), zValidator("json", BulkCreateAssetStatusValidator, validationHook), (c) => assetStatusController.bulkStore(c))
routes.post("/asset-status", authMiddleware, requirePermission("asset-status:create"), zValidator("json", CreateAssetStatusValidator, validationHook), (c) => assetStatusController.store(c))

// Asset Handover
routes.get("/handover", authMiddleware, requirePermission("handover:read"), (c) => handoverController.index(c))
routes.get("/handover/:id", authMiddleware, requirePermission("handover:read"), (c) => handoverController.show(c))
routes.post("/handover", authMiddleware, requirePermission("handover:create"), zValidator("json", CreateHandoverValidator, validationHook), (c) => handoverController.store(c))
routes.post("/handover/:id/cancel", authMiddleware, requirePermission("handover:cancel"), (c) => handoverController.cancel(c))
routes.get("/handover-field", authMiddleware, requirePermission("handover-field:read"), (c) => handoverFieldController.index(c))
routes.put("/handover-field/:transactionType", authMiddleware, requirePermission("handover-field:manage"), zValidator("json", ReplaceHandoverFieldsValidator, validationHook), (c) => handoverFieldController.replace(c))

// Inventory Stock (balance / entry / transfer / movement / holding)
// NOTE: registered before "/inventory/:id" so the static "/inventory/stock*" paths win.
routes.get("/inventory/stock/entry-template", authMiddleware, requirePermission("inventory-stock:read"), (c) => inventoryStockController.entryTemplate(c))
routes.get("/inventory/stock/movement", authMiddleware, requirePermission("inventory-stock:read"), (c) => inventoryStockController.movements(c))
routes.get("/inventory/stock/holding", authMiddleware, requirePermission("inventory-stock:read"), (c) => inventoryStockController.holdings(c))
routes.get("/inventory/stock", authMiddleware, requirePermission("inventory-stock:read"), (c) => inventoryStockController.index(c))
routes.post("/inventory/stock/entry", authMiddleware, requirePermission("inventory-stock:entry"), zValidator("json", InventoryStockEntryValidator, validationHook), (c) => inventoryStockController.entry(c))
routes.post("/inventory/stock/transfer", authMiddleware, requirePermission("inventory-stock:transfer"), zValidator("json", InventoryStockTransferValidator, validationHook), (c) => inventoryStockController.transfer(c))
routes.post("/inventory/stock/assign", authMiddleware, requirePermission("inventory-stock:assign"), zValidator("json", InventoryStockAssignValidator, validationHook), (c) => inventoryStockController.assign(c))
routes.post("/inventory/stock/return", authMiddleware, requirePermission("inventory-stock:return"), zValidator("json", InventoryStockReturnValidator, validationHook), (c) => inventoryStockController.returnStock(c))

// Inventory (master item)
routes.get("/inventory", authMiddleware, requirePermission("inventory:read"), (c) => inventoryController.index(c))
routes.get("/inventory/list", authMiddleware, requirePermission("inventory:read"), (c) => inventoryController.list(c))
routes.get("/inventory/label-keys", authMiddleware, requirePermission("inventory:read"), (c) => inventoryController.labelKeys(c))
routes.get("/inventory/:id", authMiddleware, requirePermission("inventory:read"), (c) => inventoryController.show(c))
routes.post("/inventory", authMiddleware, requirePermission("inventory:create"), zValidator("json", CreateInventoryValidator, validationHook), (c) => inventoryController.store(c))
routes.put("/inventory/:id", authMiddleware, requirePermission("inventory:update"), zValidator("json", UpdateInventoryValidator, validationHook), (c) => inventoryController.update(c))
routes.delete("/inventory/:id", authMiddleware, requirePermission("inventory:delete"), (c) => inventoryController.destroy(c))

// Inventory Variant
routes.get("/inventory-variant", authMiddleware, requirePermission("inventory-variant:read"), (c) => inventoryVariantController.index(c))
routes.get("/inventory-variant/:id", authMiddleware, requirePermission("inventory-variant:read"), (c) => inventoryVariantController.show(c))
routes.post("/inventory-variant", authMiddleware, requirePermission("inventory-variant:create"), zValidator("json", CreateInventoryVariantValidator, validationHook), (c) => inventoryVariantController.store(c))
routes.put("/inventory-variant/:id", authMiddleware, requirePermission("inventory-variant:update"), zValidator("json", UpdateInventoryVariantValidator, validationHook), (c) => inventoryVariantController.update(c))
routes.delete("/inventory-variant/:id", authMiddleware, requirePermission("inventory-variant:delete"), (c) => inventoryVariantController.destroy(c))

// Statistic
routes.get("/statistic/summary", authMiddleware, requirePermission("dashboard:read"), (c) => statisticController.summary(c))
routes.get("/statistic/assets-by-category", authMiddleware, requirePermission("dashboard:read"), (c) => statisticController.assetsByCategory(c))
routes.get("/statistic/assets-by-location", authMiddleware, requirePermission("dashboard:read"), (c) => statisticController.assetsByLocation(c))
routes.get("/statistic/assets-by-sub-category", authMiddleware, requirePermission("dashboard:read"), (c) => statisticController.assetsBySubCategory(c))
routes.get("/statistic/asset-aging", authMiddleware, requirePermission("dashboard:read"), (c) => statisticController.assetAging(c))
routes.get("/statistic/data-quality", authMiddleware, requirePermission("dashboard:read"), (c) => statisticController.dataQuality(c))
routes.get("/statistic/depreciation", authMiddleware, requirePermission("dashboard:read"), (c) => statisticController.depreciation(c))

// Role
routes.get("/role/permissions", authMiddleware, (c) => roleController.permissions(c))
routes.get("/role", authMiddleware, requirePermission("role:read"), (c) => roleController.index(c))
routes.get("/role/:id", authMiddleware, requirePermission("role:read"), (c) => roleController.show(c))
routes.post("/role", authMiddleware, requirePermission("role:create"), zValidator("json", CreateRoleValidator, validationHook), (c) => roleController.store(c))
routes.put("/role/:id", authMiddleware, requirePermission("role:update"), zValidator("json", UpdateRoleValidator, validationHook), (c) => roleController.update(c))
routes.delete("/role/:id", authMiddleware, requirePermission("role:delete"), (c) => roleController.destroy(c))

// Upload
routes.post("/upload", authMiddleware, async (c) => {
    const body = await c.req.parseBody()
    const file = body["file"]

    if (!file || !(file instanceof File)) {
        throw new BadRequestException("No file uploaded or invalid file")
    }

    const type = c.req.query("type") || "users"
    const allowedTypes = ["users", "employees", "assets"]
    const folder = allowedTypes.includes(type) ? type : "users"

    const buffer = Buffer.from(await file.arrayBuffer())
    const extension = file.name.split(".").pop() || "jpg"
    const objectName = `${folder}/${crypto.randomUUID()}.${extension}`

    const { minio } = await import("../core/helpers/minio")
    await minio.upload(objectName, buffer, file.type)

    const { ApiResponse } = await import("../core/helpers/response")
    return ApiResponse.success(c, { path: objectName }, "File uploaded successfully")
})

// Proxy MinIO
routes.get("/proxy", async (c) => {
    const path = c.req.query("path")
    if (!path) return c.json({ message: "Missing 'path' query parameter" }, 400)

    const { minio } = await import("../core/helpers/minio")
    return minio.proxyHandler(path)
})

// AI - Barcode/QR Code Decoder
routes.post("/ai/decode-barcode", authMiddleware, zValidator("form", DecodeBarcodeValidator, validationHook), (c) => aiController.decodeBarcode(c))

// Mist BLE Webhook (no auth - uses its own secret verification)
routes.post("/webhook/mist", (c) => webhookClientController.handleMist(c))
routes.post("/webhook/esign", (c) => webhookClientController.handleEsign(c))

// Book (Borrow/Return)
routes.get("/book/loan", apiKeyMiddleware, (c) => bookController.loans(c))
routes.get("/book/my-books", authMiddleware, (c) => bookController.myBooks(c))
routes.post("/book/borrow", authMiddleware, zValidator("json", BorrowBookValidator, validationHook), (c) => bookController.borrow(c))
routes.post("/book/return", authMiddleware, zValidator("json", ReturnBookValidator, validationHook), (c) => bookController.returnBook(c))

export default routes
