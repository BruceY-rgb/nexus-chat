'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { mockTeamMembers } from '@/types';
import DashboardLayout from '@/components/DashboardLayout';
import { mockChannels } from '@/types/channel';
import { Button } from '@/components/ui';

export default function DirectMessagePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [member, setMember] = useState(mockTeamMembers.find(m => m.id === userId));

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (userId) {
      const foundMember = mockTeamMembers.find(m => m.id === userId);
      setMember(foundMember);

      // 如果找不到成员，重定向回dashboard
      if (!foundMember) {
        console.warn('Member not found:', userId);
        router.push('/dashboard');
      }
    }
  }, [userId, user, loading, router]);

  if (loading || !user || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  const handleStartChat = (memberId: string) => {
    console.log('🟡 [DEBUG] 点击私聊成员:', memberId);
    router.push(`/dm/${memberId}`);
  };

  const handleNewChat = () => {
    console.log('打开新聊天对话框');
  };

  const handleLogout = async () => {
    router.push('/login');
  };

  const content = (
    <>
      {/* 私聊内容 - 直接渲染 DirectMessageView */}
      <DirectMessageView member={member} currentUserId={user.id} />
    </>
  );

  return (
    <DashboardLayout
      channels={mockChannels}
      selectedChannelId={undefined}
      joinedChannels={[]}
      selectedDirectMessageId={userId}
      onSelectChannel={() => {}}
      onCreateChannel={() => {}}
      onBrowseChannels={() => {}}
      onStartChat={handleStartChat}
      onNewChat={handleNewChat}
      onLogout={handleLogout}
    >
      {content}
    </DashboardLayout>
  );
}

// 内联 DirectMessageView 组件，避免循环导入
import DirectMessageView from '@/components/DirectMessageView';
