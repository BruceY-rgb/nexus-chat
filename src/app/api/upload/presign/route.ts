import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { getPresignedUploadUrl, validateFileType, validateFileSize } from '@/lib/s3';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (process.env.ENABLE_FILE_UPLOAD !== 'true') {
      return NextResponse.json({ error: 'File upload is disabled' }, { status: 403 });
    }

    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(unauthorizedResponse('token invalid'), { status: 401 });
    }

    const body = await request.json();
    const { fileName, mimeType, fileSize } = body;

    if (!fileName || !mimeType) {
      return NextResponse.json({ error: 'fileName and mimeType are required' }, { status: 400 });
    }

    if (!validateFileType(mimeType)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    if (fileSize && !validateFileSize(fileSize)) {
      return NextResponse.json({ error: 'File size exceeds limit' }, { status: 400 });
    }

    const result = getPresignedUploadUrl({
      fileName,
      mimeType,
      userId: decoded.userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: result.uploadUrl,
        s3Key: result.s3Key,
        s3Bucket: result.s3Bucket,
        fileUrl: result.fileUrl,
        thumbnailUrl: result.thumbnailUrl,
        fileName,
        mimeType,
        fileSize: fileSize || null,
      },
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
