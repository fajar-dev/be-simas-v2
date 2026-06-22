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
import { CreateAssetValidator, UpdateAssetValidator } from "../modules/asset/validators/asset.validator"
import { CreateAssetMaintenanceValidator, UpdateAssetMaintenanceValidator } from "../modules/asset-maintenance/validators/asset-maintenance.validator"
import { CreateAssetLocationValidator } from "../modules/asset-location/validators/asset-location.validator"
import { AssignAssetValidator, ReturnAssetValidator } from "../modules/asset-holder/validators/asset-holder.validator"
import { StoreFeedbackValidator } from "../modules/feedback/validators/feedback.validator"
import { CreateAssetStatusValidator } from "../modules/asset-status/validators/asset-status.validator"

// ── Middlewares ──────────────────────────────────────────────────────────────
import { authMiddleware } from "../core/middlewares/auth.middleware"
import { validationHook } from "../core/helpers/validator"
import { BadRequestException } from "../core/exceptions/base"

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
import { assetLocationController } from "../modules/asset-location/asset-location.module"
import { assetHolderController } from "../modules/asset-holder/asset-holder.module"
import { assetLogController } from "../modules/asset-log/asset-log.module"
import { assetStatusController } from "../modules/asset-status/asset-status.module"
import { statisticController } from "../modules/statistic/statistic.module"

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

// User
routes.get("/user", authMiddleware, (c) => userController.index(c))
routes.get("/user/:id", authMiddleware, (c) => userController.show(c))
routes.post("/user", authMiddleware, zValidator("json", CreateUserValidator, validationHook), (c) => userController.store(c))
routes.put("/user/:id", authMiddleware, zValidator("json", UpdateUserValidator, validationHook), (c) => userController.update(c))
routes.delete("/user/:id", authMiddleware, (c) => userController.destroy(c))

// Category
routes.get("/category", authMiddleware, (c) => categoryController.index(c))
routes.get("/category/:id", authMiddleware, (c) => categoryController.show(c))
routes.post("/category", authMiddleware, zValidator("json", CreateCategoryValidator, validationHook), (c) => categoryController.store(c))
routes.put("/category/:id", authMiddleware, zValidator("json", UpdateCategoryValidator, validationHook), (c) => categoryController.update(c))
routes.delete("/category/:id", authMiddleware, (c) => categoryController.destroy(c))

// Sub Category
routes.get("/sub-category", authMiddleware, (c) => subCategoryController.index(c))
routes.get("/sub-category/by-category/:categoryId", authMiddleware, (c) => subCategoryController.byCategory(c))
routes.get("/sub-category/:id", authMiddleware, (c) => subCategoryController.show(c))
routes.post("/sub-category", authMiddleware, zValidator("json", CreateSubCategoryValidator, validationHook), (c) => subCategoryController.store(c))
routes.put("/sub-category/:id", authMiddleware, zValidator("json", UpdateSubCategoryValidator, validationHook), (c) => subCategoryController.update(c))
routes.delete("/sub-category/:id", authMiddleware, (c) => subCategoryController.destroy(c))

// Feedback
routes.get("/feedback", authMiddleware, (c) => feedbackController.index(c))
routes.post("/feedback", authMiddleware, zValidator("form", StoreFeedbackValidator, validationHook), (c) => feedbackController.store(c))

// Employee
routes.get("/employee", authMiddleware, (c) => employeeController.index(c))
routes.get("/employee/:id", authMiddleware, (c) => employeeController.show(c))
routes.post("/employee", authMiddleware, zValidator("json", CreateEmployeeValidator, validationHook), (c) => employeeController.store(c))
routes.put("/employee/:id", authMiddleware, zValidator("json", UpdateEmployeeValidator, validationHook), (c) => employeeController.update(c))
routes.delete("/employee/:id", authMiddleware, (c) => employeeController.destroy(c))

// Branch
routes.get("/branch", authMiddleware, (c) => branchController.index(c))
routes.get("/branch/:id", authMiddleware, (c) => branchController.show(c))
routes.post("/branch", authMiddleware, zValidator("json", CreateBranchValidator, validationHook), (c) => branchController.store(c))
routes.put("/branch/:id", authMiddleware, zValidator("json", UpdateBranchValidator, validationHook), (c) => branchController.update(c))
routes.delete("/branch/:id", authMiddleware, (c) => branchController.destroy(c))

// Location
routes.get("/location", authMiddleware, (c) => locationController.index(c))
routes.get("/location/by-branch/:branchId", authMiddleware, (c) => locationController.byBranch(c))
routes.get("/location/:id", authMiddleware, (c) => locationController.show(c))
routes.post("/location", authMiddleware, zValidator("json", CreateLocationValidator, validationHook), (c) => locationController.store(c))
routes.put("/location/:id", authMiddleware, zValidator("json", UpdateLocationValidator, validationHook), (c) => locationController.update(c))
routes.delete("/location/:id", authMiddleware, (c) => locationController.destroy(c))

// Asset
routes.get("/asset", authMiddleware, (c) => assetController.index(c))
routes.get("/asset/check-code", authMiddleware, (c) => assetController.checkCode(c))
routes.get("/asset/label-keys", authMiddleware, (c) => assetController.getLabelKeys(c))
routes.get("/asset/export", authMiddleware, (c) => assetController.export(c))
routes.get("/asset/:id", authMiddleware, (c) => assetController.show(c))
routes.post("/asset", authMiddleware, zValidator("json", CreateAssetValidator, validationHook), (c) => assetController.store(c))
routes.put("/asset/:id", authMiddleware, zValidator("json", UpdateAssetValidator, validationHook), (c) => assetController.update(c))
routes.delete("/asset/:id", authMiddleware, (c) => assetController.destroy(c))

// Attachment
routes.post("/attachment", authMiddleware, (c) => attachmentController.upload(c))
routes.delete("/attachment/:id", authMiddleware, (c) => attachmentController.destroy(c))

// Asset Maintenance
routes.get("/asset-maintenance", authMiddleware, (c) => assetMaintenanceController.index(c))
routes.get("/asset-maintenance/:id", authMiddleware, (c) => assetMaintenanceController.show(c))
routes.post("/asset-maintenance", authMiddleware, zValidator("json", CreateAssetMaintenanceValidator, validationHook), (c) => assetMaintenanceController.store(c))
routes.put("/asset-maintenance/:id", authMiddleware, zValidator("json", UpdateAssetMaintenanceValidator, validationHook), (c) => assetMaintenanceController.update(c))
routes.delete("/asset-maintenance/:id", authMiddleware, (c) => assetMaintenanceController.destroy(c))

// Asset Location
routes.get("/asset-location", authMiddleware, (c) => assetLocationController.index(c))
routes.get("/asset-location/:id", authMiddleware, (c) => assetLocationController.show(c))
routes.post("/asset-location", authMiddleware, zValidator("json", CreateAssetLocationValidator, validationHook), (c) => assetLocationController.store(c))

// Asset Holder
routes.get("/asset-holder", authMiddleware, (c) => assetHolderController.index(c))
routes.get("/asset-holder/active/:assetId", authMiddleware, (c) => assetHolderController.active(c))
routes.get("/asset-holder/:id", authMiddleware, (c) => assetHolderController.show(c))
routes.post("/asset-holder", authMiddleware, zValidator("json", AssignAssetValidator, validationHook), (c) => assetHolderController.store(c))
routes.post("/asset-holder/:id/return", authMiddleware, zValidator("json", ReturnAssetValidator, validationHook), (c) => assetHolderController.returnAsset(c))

// Asset Log
routes.get("/asset-log", authMiddleware, (c) => assetLogController.index(c))

// Asset Status
routes.get("/asset-status", authMiddleware, (c) => assetStatusController.index(c))
routes.post("/asset-status", authMiddleware, zValidator("json", CreateAssetStatusValidator, validationHook), (c) => assetStatusController.store(c))

// Statistic
routes.get("/statistic/summary", authMiddleware, (c) => statisticController.summary(c))
routes.get("/statistic/assets-by-category", authMiddleware, (c) => statisticController.assetsByCategory(c))
routes.get("/statistic/assets-by-location", authMiddleware, (c) => statisticController.assetsByLocation(c))
routes.get("/statistic/assets-by-sub-category", authMiddleware, (c) => statisticController.assetsBySubCategory(c))
routes.get("/statistic/asset-aging", authMiddleware, (c) => statisticController.assetAging(c))
routes.get("/statistic/data-quality", authMiddleware, (c) => statisticController.dataQuality(c))


// Upload
routes.post("/upload", authMiddleware, async (c) => {
    const body = await c.req.parseBody()
    const file = body["file"]

    if (!file || !(file instanceof File)) {
        throw new BadRequestException("No file uploaded or invalid file")
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extension = file.name.split(".").pop() || "jpg"
    const objectName = `users/${crypto.randomUUID()}.${extension}`

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

export default routes
