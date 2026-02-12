import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

type NotificationLevel = 'all' | 'mentions' | 'nothing';

// 更新 DM 通知偏好 API
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;
    const conversationId = params.id;

    const body = await request.json();
    const { notificationLevel } = body as { notificationLevel: NotificationLevel };

    // 验证 notificationLevel 的值
    if (!notificationLevel || !['all', 'mentions', 'nothing'].includes(notificationLevel)) {
      return NextResponse.json(
        { error: 'Invalid notification level. Must be "all", "mentions", or "nothing"' },
        { status: 400 }
      );
    }

    // 检查 DM 会话是否存在
    const conversation = await prisma.dMConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // 更新 DM 成员的通知偏好
    const updatedMember = await prisma.dMConversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId
        }
      },
      data: {
        notificationLevel
      }
    });

    return NextResponse.json({
      message: 'Notification preferences updated successfully',
      notificationLevel: updatedMember.notificationLevel
    });
  } catch (error) {
    console.error('Error updating DM notification preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 获取 DM 通知偏好 API
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;
    const conversationId = params.id;

    // 获取 DM 成员的通知偏好
    const member = await prisma.dMConversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId
        }
      }
    });

    if (!member) {
      return NextResponse.json(
        { error: 'You are not a member of this conversation' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      notificationLevel: member.notificationLevel
    });
  } catch (error) {
    console.error('Error getting DM notification preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
