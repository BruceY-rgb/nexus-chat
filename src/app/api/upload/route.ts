import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { uploadFile, validateFileType, validateFileSize, getAllowedFileTypes } from '@/lib/s3';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('Invalid token'),
        { status: 401 }
      );
    }

    const userId = decoded.userId;

    // Check feature flag
    if (process.env.ENABLE_FILE_UPLOAD !== 'true') {
      return NextResponse.json(
        { error: 'File upload is disabled' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Check file count limit
    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files allowed per upload' },
        { status: 400 }
      );
    }

    const uploadResults = [];

    // Process each file
    for (const file of files) {
      // Validate file type
      if (!validateFileType(file.type)) {
        const allowedTypes = getAllowedFileTypes();
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}` },
          { status: 400 }
        );
      }

      // Validate file size
      if (!validateFileSize(file.size)) {
        return NextResponse.json(
          { error: `File too large. Maximum size: ${Math.round((parseInt(process.env.MAX_FILE_SIZE || '10485760') / 1024 / 1024))}MB` },
          { status: 400 }
        );
      }

      // Convert file to Buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      try {
        // Upload to S3
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

// Handle OPTIONS request (CORS preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
