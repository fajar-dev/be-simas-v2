import { GoogleGenerativeAI } from "@google/generative-ai"
import { BadRequestException } from "../../core/exceptions/base"
import { config } from "../../config/config"

export class AiService {
    private genAI: GoogleGenerativeAI

    constructor() {
        if (!config.gemini.apiKey) {
            throw new Error("GEMINI_API_KEY is not configured")
        }
        this.genAI = new GoogleGenerativeAI(config.gemini.apiKey)
    }

    /**
     * Decode barcode or QR code from an uploaded image using Gemini Vision.
     * Throws BadRequestException if the image doesn't contain a valid barcode/QR code
     * or if the image is too unclear to read.
     */
    async decodeBarcode(file: File): Promise<{ type: string; content: string }> {
        // Convert file to base64
        const buffer = Buffer.from(await file.arrayBuffer())
        const base64Data = buffer.toString("base64")

        const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

        const prompt = `Analyze this image carefully. Your task is to:

1. Determine if the image contains a barcode (1D barcode like Code128, Code39, EAN, UPC, etc.) or a QR code (2D barcode).
2. If it contains a barcode or QR code, decode and extract the exact content/data encoded in it.
3. If the image does NOT contain any barcode or QR code, respond with exactly: NO_CODE_FOUND
4. If the image is too blurry, unclear, or the barcode/QR code is unreadable, respond with exactly: IMAGE_UNCLEAR

Respond ONLY in this exact JSON format (no markdown, no code blocks, just raw JSON):
{"type": "qrcode" or "barcode", "content": "the decoded content here"}

Or if no code found:
{"error": "NO_CODE_FOUND"}

Or if image is unclear:
{"error": "IMAGE_UNCLEAR"}`

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: file.type,
                    data: base64Data,
                },
            },
        ])

        const response = result.response
        const text = response.text().trim()

        // Parse the JSON response from Gemini
        let parsed: any
        try {
            const cleanText = text
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim()
            parsed = JSON.parse(cleanText)
        } catch {
            throw new BadRequestException("Failed to process the image")
        }

        // Handle error responses from Gemini
        if (parsed.error) {
            if (parsed.error === "NO_CODE_FOUND") {
                throw new BadRequestException("No barcode or QR code found in the image")
            }
            if (parsed.error === "IMAGE_UNCLEAR") {
                throw new BadRequestException("Image is too blurry or unclear")
            }
            throw new BadRequestException(parsed.error)
        }

        if (!parsed.type || !parsed.content) {
            throw new BadRequestException("Failed to read the code from the image")
        }

        return {
            type: parsed.type,
            content: parsed.content,
        }
    }
}
