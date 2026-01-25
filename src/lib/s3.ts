import OSS from 'ali-oss';

// 阿里云 OSS 配置
const ossClient = new OSS({
  accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  bucket: process.env.OSS_BUCKET!,
  endpoint: process.env.OSS_ENDPOINT
});

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
 * 上传文件到阿里云 OSS
 */
export async function uploadFile({
  file,
  fileName,
  mimeType,
  userId
}: UploadParams): Promise<UploadResult> {
  try {
    // 生成唯一文件名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = fileName.split('.').pop();
    const uniqueFileName = `${userId}/${timestamp}-${randomString}.${extension}`;

    const s3Bucket = process.env.OSS_BUCKET!;
    const s3Key = uniqueFileName;

    // 上传到 OSS
    const result = await ossClient.put(s3Key, file, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,  // 确保文件名编码正确
        'Cache-Control': 'public, max-age=31536000'  // 添加缓存控制
      }
    });

    // 构建文件 URL
    let fileUrl = result.url;

    // 如果配置了自定义域名，使用自定义域名
    if (process.env.OSS_CUSTOM_DOMAIN) {
      fileUrl = `https://${process.env.OSS_CUSTOM_DOMAIN}/${s3Key}`;
    }

    // 如果是图片，生成缩略图URL（暂时使用原图，实际可以使用 OSS 图片处理服务）
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
    throw new Error('文件上传失败');
  }
}

/**
 * 从 OSS 删除文件
 */
export async function deleteFile(s3Key: string): Promise<void> {
  try {
    await ossClient.delete(s3Key);
  } catch (error) {
    console.error('Error deleting file from OSS:', error);
    throw new Error('文件删除失败');
  }
}

/**
 * 生成预签名 URL（用于私有 Bucket 访问）
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const url = ossClient.signatureUrl(key, {
      expires: expiresIn
    });
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('生成文件链接失败');
  }
}

/**
 * 生成用于预览的内联 URL（私有 Bucket）
 * 添加参数确保浏览器以 inline 方式处理文件
 */
export function getPreviewInlineUrl(fileUrl: string): string {
  // 如果 URL 已经包含参数，添加 &response-content-type=inline
  // 如果没有参数，添加 ?response-content-type=inline
  if (fileUrl.includes('?')) {
    return `${fileUrl}&response-content-type=inline`;
  }
  return `${fileUrl}?response-content-type=inline`;
}

/**
 * 获取允许的文件类型列表
 */
export function getAllowedFileTypes(): string[] {
  return [
    // 图片类型
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // 文档类型
    'application/pdf',
    'text/plain',
    // Office 文档 - Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Office 文档 - Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Office 文档 - PowerPoint
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // 压缩包
    'application/zip',
    'application/x-zip-compressed'
  ];
}

/**
 * 验证文件类型
 */
export function validateFileType(mimeType: string): boolean {
  const allowedTypes = getAllowedFileTypes();
  return allowedTypes.includes(mimeType);
}

/**
 * 检查文件是否支持在线预览
 */
export function canPreviewInline(mimeType: string, fileSize: number): boolean {
  // 支持预览的文件类型
  const previewableTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/xml'
  ];

  // 检查文件类型
  if (!previewableTypes.includes(mimeType)) {
    return false;
  }

  // 检查文件大小（超过 50MB 的文件不建议预览）
  const maxPreviewSize = 50 * 1024 * 1024; // 50MB
  return Number(fileSize) <= maxPreviewSize;
}

/**
 * 验证文件大小
 */
export function validateFileSize(fileSize: number): boolean {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB 默认
  return fileSize <= maxSize;
}

export default ossClient;
