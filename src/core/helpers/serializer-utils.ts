import { minio } from "./minio"

/**
 * Resolve a MinIO storage path to a presigned URL
 * Shared utility to avoid code duplication across serializers
 */
export async function resolvePhotoUrl(photo?: string | null): Promise<string | null> {
    if (!photo) return null
    return await minio.getPresignedUrl(photo)
}
