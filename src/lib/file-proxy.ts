/**
 * Convert direct OSS URL to proxy URL
 * This bypasses CORS issues when accessing OSS files from browser
 */
export function getProxyUrl(filePath: string): string {
  if (!filePath) return filePath;

  // If already a proxy URL, return as is
  if (filePath.startsWith('/api/file-proxy')) {
    return filePath;
  }

  // Extract s3Key from the URL
  // Example: https://q-and-a-chatbot.oss-cn-hangzhou.aliyuncs.com/import/xxx.png
  // -> /api/file-proxy?key=import/xxx.png
  try {
    const url = new URL(filePath);
    const pathname = url.pathname;
    // Remove leading slash from pathname
    const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    return `/api/file-proxy?key=${encodeURIComponent(key)}`;
  } catch {
    // If URL parsing fails, return original
    return filePath;
  }
}
