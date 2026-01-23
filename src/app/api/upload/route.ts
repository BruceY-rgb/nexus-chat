import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { uploadFile, validateFileType, validateFileSize } from '@/lib/s3';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // 验证认证
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    // 验证 token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    const userId = decoded.userId;

    // 检查功能开关
    if (process.env.ENABLE_FILE_UPLOAD !== 'true') {
      return NextResponse.json(
        { error: 'File upload is disabled' },
        { status: 403 }
      );
    }

    // 解析表单数据
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // 检查文件数量限制
    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files allowed per upload' },
        { status: 400 }
      );
    }

    const uploadResults = [];

    // 处理每个文件
    for (const file of files) {
      // 验证文件类型
      if (!validateFileType(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Allowed types: image/jpeg, image/png, image/gif, image/webp, application/pdf, text/plain` },
          { status: 400 }
        );
      }

      // 验证文件大小
      if (!validateFileSize(file.size)) {
        return NextResponse.json(
          { error: `File too large. Maximum size: ${Math.round((parseInt(process.env.MAX_FILE_SIZE || '10485760') / 1024 / 1024))}MB` },
          { status: 400 }
        );
      }

      // 转换文件为 Buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      try {
        // 上传到 S3
        const result = await uploadFile({
          file: buffer,
          fileName: file.name,
          mimeType: file.type,
          userId
        });

        uploadResults.push({
          originalName: file.name,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          ...result
        });
      } catch (uploadError) {
        console.error(`Error uploading file ${file.name}:`, uploadError);
        return NextResponse.json(
          { error: `Failed to upload ${file.name}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      files: uploadResults
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
