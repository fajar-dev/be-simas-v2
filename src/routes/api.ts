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
import { StoreFeedbackValidator } from "../modules/feedback/validators/feedback.validator"

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
