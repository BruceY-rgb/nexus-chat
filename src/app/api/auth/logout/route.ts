// =====================================================
// 用户登出 API
// POST /api/auth/logout
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { deleteUserSession } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (token) {
      // 删除会话
      await deleteUserSession(token);
    }

    // 创建响应
    const response = NextResponse.json(
      successResponse(null, 'Logout successful')
    );

    // 清除 cookie
    response.cookies.delete('auth_token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      errorResponse('Logout failed'),
      { status: 500 }
    );
  }
}