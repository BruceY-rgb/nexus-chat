'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button, Avatar } from '@/components/ui';
import DirectMessages from '@/components/DirectMessages';
import Channels from '@/components/Channels';
import { TeamMember } from '@/types';
import { mockChannels, Channel } from '@/types/channel';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useUnreadStore } from '@/store/unreadStore';
import { LogOut, Settings } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  channels?: Channel[];
  selectedChannelId?: string;
  joinedChannels?: string[];
  selectedDirectMessageId?: string;
  onSelectChannel?: (channelId: string) => void;
  onCreateChannel?: (channel: Channel) => void;
  onBrowseChannels?: () => void;
  onStartChat?: (memberId: string, dmConversationId?: string) => void;
  onNewChat?: () => void;
  onLogout?: () => void;
}

export default function DashboardLayout({
  children,
  channels = [],
  selectedChannelId,
  joinedChannels = [],
  selectedDirectMessageId,
  onSelectChannel,
  onCreateChannel,
  onBrowseChannels,
  onStartChat,
  onNewChat,
  onLogout
}: DashboardLayoutProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // 初始化未读计数系统
  const { markAsRead } = useUnreadCount();
  const { totalUnreadCount } = useUnreadStore();

  // 调试：打印未读计数状态
  useEffect(() => {
    console.log('📊 DashboardLayout - Total unread count:', totalUnreadCount);
  }, [totalUnreadCount]);

  // 当选择频道时，清除未读计数
  const handleSelectChannel = (channelId: string) => {
    console.log('📖 Marking channel as read:', channelId);
    markAsRead(channelId);
    onSelectChannel?.(channelId);
  };

  // 开始聊天时，清除未读计数
  const handleStartChat = (memberId: string, dmConversationId?: string) => {
    // 使用传入的 dmConversationId，或回退到 memberId
    const conversationId = dmConversationId || memberId;

    console.log('📖 Marking DM as read:', { memberId, conversationId });
    markAsRead(undefined, conversationId);
    onStartChat?.(memberId, dmConversationId);
  };

  // 获取团队成员列表
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const response = await fetch('/api/users', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setTeamMembers(data.users || []);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchTeamMembers();
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-full">
        {/* 左侧边栏 */}
        <div className="w-64 h-full bg-slack-purple flex flex-col">
          {/* 顶部用户信息 - 固定不滚动 */}
          <div className="flex-shrink-0 p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Avatar
                src={user?.avatarUrl || undefined}
                alt={user?.displayName}
                size="md"
                fallback={user?.displayName}
                online={user?.isOnline}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.displayName}</p>
                <p className="text-white/60 text-xs truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/profile')}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 频道和私聊列表 - 独立滚动 */}
          <div className="flex-1 min-h-0 overflow-y-auto py-4 sidebar-scroll">
            <Channels
              channels={channels}
              selectedChannelId={selectedChannelId}
              joinedChannels={joinedChannels}
              onSelectChannel={handleSelectChannel}
              onCreateChannel={onCreateChannel}
              onBrowseChannels={onBrowseChannels}
            />
            <DirectMessages
              members={teamMembers}
              currentUserId={user?.id || ''}
              selectedDirectMessageId={selectedDirectMessageId}
              onStartChat={handleStartChat}
              onNewChat={onNewChat}
            />
          </div>

          {/* 底部登出按钮 - 固定不滚动 */}
          <div className="flex-shrink-0 p-4 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={onLogout}
              className="w-full text-white/70 hover:text-white hover:bg-white/10 justify-start"
            >
              <LogOut className="w-4 h-4 mr-2" />
              登出
            </Button>
          </div>
        </div>

        {/* 右侧主内容区 */}
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
