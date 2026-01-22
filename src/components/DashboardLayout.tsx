'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button, Avatar } from '@/components/ui';
import DirectMessages from '@/components/DirectMessages';
import Channels from '@/components/Channels';
import { mockTeamMembers } from '@/types';
import { mockChannels, Channel } from '@/types/channel';
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
  onStartChat?: (memberId: string) => void;
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
          <div className="flex-1 overflow-y-auto py-4 sidebar-scroll">
            <Channels
              channels={channels}
              selectedChannelId={selectedChannelId}
              joinedChannels={joinedChannels}
              onSelectChannel={onSelectChannel}
              onCreateChannel={onCreateChannel}
              onBrowseChannels={onBrowseChannels}
            />
            <DirectMessages
              members={mockTeamMembers}
              currentUserId={user?.id || ''}
              selectedDirectMessageId={selectedDirectMessageId}
              onStartChat={onStartChat}
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
        <div className="flex-1 h-full flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
