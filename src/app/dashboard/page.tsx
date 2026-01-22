'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import DashboardLayout from '@/components/DashboardLayout';
import ChannelHeader from '@/components/ChannelHeader';
import ChannelView from '@/components/ChannelView';
import BrowseChannels from '@/components/BrowseChannels';
import NewDirectMessageModal from '@/components/NewDirectMessageModal';
import { Channel as ChannelType } from '@/types/channel';

// 类型定义 - 匹配API返回数据格式
interface User {
  id: string;
  email: string;
  displayName: string;
  realName?: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeenAt?: Date;
}

interface ApiChannel {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  createdAt: Date;
  createdBy: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  memberCount: number;
  isJoined: boolean;
}

export default function DashboardPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string | undefined;

  const [selectedChat, setSelectedChat] = useState<string | undefined>(undefined);
  const [selectedChannel, setSelectedChannel] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<ApiChannel[]>([]);
  const [joinedChannels, setJoinedChannels] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<'channel' | 'browse'>('channel');
  const [isNewDMModalOpen, setIsNewDMModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // 可以添加加载状态的UI显示
  const isLoading = isLoadingChannels || isLoadingUsers;

  // 获取频道数据
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setIsLoadingChannels(true);
        const response = await fetch('/api/channels', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setChannels(data.channels);

          // 获取已加入的频道ID
          const joined = data.channels
            .filter((channel: ApiChannel) => channel.isJoined)
            .map((channel: ApiChannel) => channel.id);
          setJoinedChannels(joined);

          // 如果没有选中的频道，选中第一个已加入的频道
          if (!selectedChannel && joined.length > 0) {
            setSelectedChannel(joined[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching channels:', error);
      } finally {
        setIsLoadingChannels(false);
      }
    };

    if (user) {
      fetchChannels();
    }
  }, [user, selectedChannel]);

  // 获取用户数据
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        const response = await fetch('/api/users', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    if (user) {
      fetchUsers();
    }
  }, [user]);

  // 监听路由变化，同步状态
  useEffect(() => {
    if (userId) {
      const member = users.find(u => u.id === userId);
      if (member) {
        setSelectedChat(userId);
        setSelectedChannel(undefined);
        setCurrentView('channel');
      }
    }
  }, [userId, users]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('登出失败:', err);
    }
  };

  const handleStartChat = (memberId: string) => {
    console.log('🟡 [DEBUG] 点击私聊成员:', memberId);
    console.log('🟡 [DEBUG] 准备跳转到 /dm/' + memberId);

    // 更新当前选中的私聊
    setSelectedChat(memberId);
    // 清除选中的频道
    setSelectedChannel(undefined);

    // 使用 router.push 进行导航
    router.push(`/dm/${memberId}`);

    console.log('🟢 [DEBUG] router.push 已调用');
  };

  const handleNewChat = () => {
    console.log('打开新聊天对话框');
    setIsNewDMModalOpen(true);
  };

  const handleSelectMemberFromModal = (memberId: string) => {
    console.log('🟡 [DEBUG] 从模态框选择成员:', memberId);
    handleStartChat(memberId);
  };

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannel(channelId);
    setSelectedChat(undefined); // 清除选中的私聊
    setCurrentView('channel');
  };

  const handleCreateChannel = (newChannel: ChannelType) => {
    // 将Channel类型转换为ApiChannel类型
    const apiChannel: ApiChannel = {
      id: newChannel.id,
      name: newChannel.name,
      description: newChannel.description,
      isPrivate: newChannel.type === 'private',
      createdAt: newChannel.createdAt,
      createdBy: {
        id: newChannel.ownerId,
        displayName: '',
        avatarUrl: undefined
      },
      memberCount: newChannel.memberCount || 1,
      isJoined: true
    };
    setChannels(prevChannels => [...prevChannels, apiChannel]);
    setJoinedChannels(prev => [...prev, apiChannel.id]); // 自动加入新创建的频道
    setSelectedChannel(apiChannel.id);
    console.log('创建新频道:', apiChannel);
  };

  const handleJoinChannel = (channelId: string) => {
    setJoinedChannels(prev => [...prev, channelId]);
    setCurrentView('channel');
    setSelectedChannel(channelId);
    console.log('加入频道:', channelId);
  };

  const handleLeaveChannel = (channelId: string) => {
    setJoinedChannels(prev => prev.filter(id => id !== channelId));

    // 如果退出的频道是当前选中的频道，则切换到 #general
    if (selectedChannel === channelId) {
      const generalChannel = channels.find(c => c.id === 'channel-1');
      if (generalChannel && joinedChannels.includes(generalChannel.id)) {
        setSelectedChannel(generalChannel.id);
      } else {
        // 如果 #general 也退出了，选择第一个加入的频道
        const firstJoined = joinedChannels.find(id => id !== channelId);
        if (firstJoined) {
          setSelectedChannel(firstJoined);
        } else {
          setSelectedChannel(undefined);
        }
      }
    }
    console.log('退出频道:', channelId);
  };

  const handleBrowseChannels = () => {
    setCurrentView('browse');
    setSelectedChat(undefined);
  };

  const handleBackToChannel = () => {
    setCurrentView('channel');
    // 返回到之前选中的频道，如果没有则默认选择第一个
    if (!selectedChannel && joinedChannels.length > 0) {
      setSelectedChannel(joinedChannels[0]);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  // 过滤掉当前用户，获取其他成员
  // 将User转换为TeamMember格式以兼容NewDirectMessageModal
  const availableMembers = users
    .filter(member => member.id !== user.id)
    .map(user => ({
      id: user.id,
      name: user.realName || user.displayName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || '',
      status: user.isOnline ? 'online' as const : 'offline' as const,
      role: 'member' as const,
      email: user.email
    }));

  // 转换ApiChannel为Channel类型以匹配组件期望
  const convertedChannels: ChannelType[] = channels.map(channel => ({
    id: channel.id,
    name: channel.name,
    description: channel.description,
    type: channel.isPrivate ? 'private' as const : 'public' as const,
    createdAt: channel.createdAt,
    ownerId: channel.createdBy.id,
    memberCount: channel.memberCount
  }));

  const content = (
    <>
      {/* 浏览频道视图 */}
      {currentView === 'browse' ? (
        <BrowseChannels
          channels={convertedChannels}
          userId={user.id}
          onJoinChannel={handleJoinChannel}
          onLeaveChannel={handleLeaveChannel}
          onSelectChannel={handleSelectChannel}
          onBack={handleBackToChannel}
        />
      ) : (
        <>
          {/* 频道头部 */}
          {selectedChannel && (
            <ChannelHeader
              channel={convertedChannels.find(c => c.id === selectedChannel)!}
              onLeaveChannel={handleLeaveChannel}
            />
          )}

          {/* 主内容区 */}
          <div className="flex-1 bg-background">
            {selectedChannel ? (
              <ChannelView
                channel={convertedChannels.find(c => c.id === selectedChannel)!}
                isJoined={joinedChannels.includes(selectedChannel)}
                onJoinChannel={handleJoinChannel}
                onLeaveChannel={handleLeaveChannel}
                onStartChat={handleStartChat}
              />
            ) : selectedChat ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-text-primary mb-2">Direct Message</h2>
                  <p className="text-text-secondary mb-6">
                    选择左侧的成员开始私聊
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      const firstMember = availableMembers[0];
                      if (firstMember) {
                        handleStartChat(firstMember.id);
                      }
                    }}
                    disabled={availableMembers.length === 0}
                  >
                    开始聊天
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-text-primary mb-2">欢迎使用 Slack</h2>
                  <p className="text-text-secondary mb-6">
                    从左侧选择一个频道或成员开始交流
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      const firstMember = availableMembers[0];
                      if (firstMember) {
                        handleStartChat(firstMember.id);
                      }
                    }}
                    disabled={availableMembers.length === 0}
                  >
                    开始聊天
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* New Direct Message Modal */}
      <NewDirectMessageModal
        isOpen={isNewDMModalOpen}
        onClose={() => setIsNewDMModalOpen(false)}
        members={availableMembers}
        currentUserId={user.id}
        onSelectMember={handleSelectMemberFromModal}
      />
    </>
  );

  return (
    <DashboardLayout
      channels={convertedChannels}
      selectedChannelId={selectedChannel}
      joinedChannels={joinedChannels}
      selectedDirectMessageId={selectedChat}
      onSelectChannel={handleSelectChannel}
      onCreateChannel={handleCreateChannel}
      onBrowseChannels={handleBrowseChannels}
      onStartChat={handleStartChat}
      onNewChat={handleNewChat}
      onLogout={handleLogout}
    >
      {content}
    </DashboardLayout>
  );
}
