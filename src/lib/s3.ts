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
        'Content-Type': mimeType
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
    const url = await ossClient.signatureUrl(key, {
      expires: expiresIn
    });
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('生成文件链接失败');
  }
}

/**
 * 验证文件类型
 */
export function validateFileType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain'
  ];
  return allowedTypes.includes(mimeType);
}

/**
 * 验证文件大小
 */
export function validateFileSize(fileSize: number): boolean {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB 默认
  return fileSize <= maxSize;
}

export default ossClient;
