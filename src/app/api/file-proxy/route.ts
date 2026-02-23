import { NextRequest, NextResponse } from "next/server";
import { getSignedUrl } from "@/lib/s3";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const s3Key = searchParams.get("key");

  if (!s3Key) {
    return NextResponse.json(
      { error: "Missing 'key' parameter" },
      { status: 400 }
    );
  }

  try {
    // Generate signed URL from OSS
    const signedUrl = await getSignedUrl(s3Key);

    // Fetch the file through the server (bypassing CORS)
    const response = await fetch(signedUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch file from storage" },
        { status: response.status }
      );
    }

    // Get headers from the original response
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    // Get the file content
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return the file with proper headers
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }
    headers.set("Cache-Control", "public, max-age=31536000");

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error proxying file:", error);
    return NextResponse.json(
      { error: "Failed to proxy file" },
      { status: 500 }
    );
  }
}
