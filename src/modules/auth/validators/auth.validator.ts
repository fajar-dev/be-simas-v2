import { z } from 'zod'

export const RegisterValidator = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Invalid email format"),
  password: z.string().trim().min(6, "Password must be at least 6 characters"),
})

export type RegisterValidator = z.infer<typeof RegisterValidator>

export const LoginValidator = z.object({
  email: z.email("Email is required"),
  password: z.string().trim().min(1, "Password is required"),
})

export type LoginValidator = z.infer<typeof LoginValidator>

export const ForgotPasswordValidator = z.object({
  email: z.email("Invalid email format"),
})

export type ForgotPasswordValidator = z.infer<typeof ForgotPasswordValidator>

export const ResetPasswordValidator = z.object({
  token: z.string().trim().min(1, "Reset token is required"),
  newPassword: z.string().trim().min(6, "Password must be at least 6 characters"),
})

export type ResetPasswordValidator = z.infer<typeof ResetPasswordValidator>

export const RefreshTokenValidator = z.object({
  refreshToken: z.string().trim().min(1, "Refresh token is required"),
})

export type RefreshTokenValidator = z.infer<typeof RefreshTokenValidator>

export const GoogleLoginValidator = z.object({
    code: z.string().trim().min(1, 'Code is required'),
})

export type GoogleLoginValidator = z.infer<typeof GoogleLoginValidator>

export const UpdateProfileValidator = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email format"),
  photo: z.string().trim().nullable().optional(),
})

export type UpdateProfileValidator = z.infer<typeof UpdateProfileValidator>

export const UpdatePasswordValidator = z.object({
  oldPassword: z.string().trim().optional(),
  newPassword: z.string().trim().min(6, "Password must be at least 6 characters"),
})

export type UpdatePasswordValidator = z.infer<typeof UpdatePasswordValidator>