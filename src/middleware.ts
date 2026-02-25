// =====================================================
// Next.js middleware
// Used to protect routes that require authentication
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const pathname = request.nextUrl.pathname;

  // Paths that require authentication
  const protectedPaths = ['/dashboard', '/channels', '/settings', '/profile', '/api/messages', '/api/channels'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // Check authentication status
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

// Configure middleware matching paths
export const config = {
  matcher: [
    /*
     * Match all paths except those starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - login (Login page)
     * - register (Register page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|login|register).*)',
  ],
};