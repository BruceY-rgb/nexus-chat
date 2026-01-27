// =====================================================
// Next.js 中间件
// 用于保护需要认证的路由
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const pathname = request.nextUrl.pathname;

  // 需要认证的路径
  const protectedPaths = ['/dashboard', '/channels', '/settings', '/profile', '/api/messages', '/api/channels'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // 检查认证状态
  const isAuthenticated = token ? true : false;

  // If accessing protected route without authentication, redirect to login page
  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated but accessing login page, redirect to dashboard
  if ((pathname === '/login' || pathname === '/register') && isAuthenticated) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

// 配置中间件匹配路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了以下开头的：
     * - api (API 路由)
     * - _next/static (静态文件)
     * - _next/image (图像优化)
     * - favicon.ico (favicon 文件)
     * - login (Login page)
     * - register (Register page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|login|register).*)',
  ],
};