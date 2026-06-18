import { z } from "zod"

export const StoreFeedbackValidator = z.object({
    message: z.string().min(1, "Message is required"),
    type: z.string().min(1, "Type is required"),
    url: z.string().optional(),
    "images[]": z.union([
        z.instanceof(File)
            .refine((file) => file.size > 0, "File cannot be empty")
            .refine((file) => file.type.startsWith("image/"), "Only image files are allowed"),
        z.array(
            z.instanceof(File)
                .refine((file) => file.size > 0, "File cannot be empty")
                .refine((file) => file.type.startsWith("image/"), "Only image files are allowed")
        ).min(1, "At least 1 image is required").max(5, "Maximum 5 images allowed")
    ])
})

export type StoreFeedbackValidator = z.infer<typeof StoreFeedbackValidator>