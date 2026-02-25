import OSS from 'ali-oss';

// Lazy initialize OSS client (avoid needing environment variables at build time)
function getOssClient(): OSS {
  return new OSS({
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    bucket: process.env.OSS_BUCKET!,
    endpoint: process.env.OSS_ENDPOINT
  });
}

export interface UploadParams {
  file: Buffer;
  fileName: string;
  mimeType: string;
  userId: string;
}

export interface UploadResult {
  s3Key: string;
  s3Bucket: string;
  fileUrl: string;
  thumbnailUrl?: string;
}

/**
 * Upload file to Alibaba Cloud OSS
 */
export async function uploadFile({
  file,
  fileName,
  mimeType,
  userId
}: UploadParams): Promise<UploadResult> {
  try {
    // Generate unique file name
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = fileName.split('.').pop();
    const uniqueFileName = `${userId}/${timestamp}-${randomString}.${extension}`;

    const s3Bucket = process.env.OSS_BUCKET!;
    const s3Key = uniqueFileName;

    // Upload to OSS
    const ossClient = getOssClient();
    const result = await ossClient.put(s3Key, file, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,  // Ensure filename encoding is correct
        'Cache-Control': 'public, max-age=31536000'  // Add cache control
      }
    });

    // Build file URL
    let fileUrl = result.url;

    // If custom domain is configured, use custom domain
    if (process.env.OSS_CUSTOM_DOMAIN) {
      fileUrl = `https://${process.env.OSS_CUSTOM_DOMAIN}/${s3Key}`;
    }

    // If it's an image, generate thumbnail URL (temporarily use original, actually can use OSS image processing service)
    let thumbnailUrl: string | undefined;
    if (mimeType.startsWith('image/')) {
      thumbnailUrl = fileUrl;
    }

    return {
      s3Key,
      s3Bucket,
      fileUrl,
      thumbnailUrl
    };
  } catch (error) {
    console.error('Error uploading file to OSS:', error);
    throw new Error('File upload failed');
  }
}

/**
 * Delete file from OSS
 */
export async function deleteFile(s3Key: string): Promise<void> {
  try {
    const ossClient = getOssClient();
    await ossClient.delete(s3Key);
  } catch (error) {
    console.error('Error deleting file from OSS:', error);
    throw new Error('File deletion failed');
  }
}

/**
 * Generate presigned URL for uploading a file directly to OSS
 */
export function getPresignedUploadUrl(params: {
  fileName: string;
  mimeType: string;
  userId: string;
  expiresIn?: number;
}): { uploadUrl: string; s3Key: string; s3Bucket: string; fileUrl: string; thumbnailUrl?: string } {
  const { fileName, mimeType, userId, expiresIn = 600 } = params;

  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(7);
  const extension = fileName.split('.').pop();
  const s3Key = `${userId}/${timestamp}-${randomString}.${extension}`;
  const s3Bucket = process.env.OSS_BUCKET!;

  const ossClient = getOssClient();
  const uploadUrl = ossClient.signatureUrl(s3Key, {
    method: 'PUT',
    expires: expiresIn,
    'Content-Type': mimeType,
  });

  let fileUrl: string;
  if (process.env.OSS_CUSTOM_DOMAIN) {
    fileUrl = `https://${process.env.OSS_CUSTOM_DOMAIN}/${s3Key}`;
  } else {
    fileUrl = `https://${s3Bucket}.${(process.env.OSS_REGION || 'oss-cn-hangzhou')}.aliyuncs.com/${s3Key}`;
  }

  const thumbnailUrl = mimeType.startsWith('image/') ? fileUrl : undefined;

  return { uploadUrl, s3Key, s3Bucket, fileUrl, thumbnailUrl };
}

/**
 * Generate pre-signed URL (for private bucket access)
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const ossClient = getOssClient();
    const url = ossClient.signatureUrl(key, {
      expires: expiresIn
    });
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate file link');
  }
}

/**
 * Generate inline URL for preview (private bucket)
 * Add parameters to ensure browser handles file inline
 */
export function getPreviewInlineUrl(fileUrl: string): string {
  // If URL already contains parameters, add &response-content-type=inline
  // If no parameters, add ?response-content-type=inline
  if (fileUrl.includes('?')) {
    return `${fileUrl}&response-content-type=inline`;
  }
  return `${fileUrl}?response-content-type=inline`;
}

/**
 * Get list of allowed file types
 */
export function getAllowedFileTypes(): string[] {
  return [
    // Image types
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Document types
    'application/pdf',
    'text/plain',
    // Office documents - Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Office documents - Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Office documents - PowerPoint
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Compressed files
    'application/zip',
    'application/x-zip-compressed'
  ];
}

/**
 * Validate file type
 */
export function validateFileType(mimeType: string): boolean {
  const allowedTypes = getAllowedFileTypes();
  return allowedTypes.includes(mimeType);
}

/**
 * Check if file supports inline preview
 */
export function canPreviewInline(mimeType: string, fileSize: number): boolean {
  // File types that support preview
  const previewableTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Videos
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    // Documents
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/xml'
  ];

  // Check file type
  if (!previewableTypes.includes(mimeType)) {
    return false;
  }

  // Check file size (files over 50MB are not recommended for preview)
  const maxPreviewSize = 50 * 1024 * 1024; // 50MB
  return Number(fileSize) <= maxPreviewSize;
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number): boolean {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
  return fileSize <= maxSize;
}

export default getOssClient;
