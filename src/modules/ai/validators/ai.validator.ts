import { z } from "zod"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const DecodeBarcodeValidator = z.object({
    image: z
        .instanceof(File, { message: "Image field must be a file" })
        .refine((file) => file.size > 0, "File cannot be empty")
        .refine((file) => file.size <= MAX_FILE_SIZE, "Image file size must be less than 10MB")
        .refine((file) => file.type.startsWith("image/"), "File must be an image (JPEG, PNG, WebP, etc.)"),
})

export type DecodeBarcodeValidator = z.infer<typeof DecodeBarcodeValidator>
