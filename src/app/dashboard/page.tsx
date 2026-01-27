'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import DashboardLayout from '@/components/DashboardLayout';
import ChannelView from '@/components/ChannelView';
import BrowseChannels from '@/components/BrowseChannels';
import NewDirectMessageModal from '@/components/NewDirectMessageModal';
import { Channel as ChannelType } from '@/types/channel';

// Type definitions - matching API response data format
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
  const [isJoiningChannel, setIsJoiningChannel] = useState<string | undefined>(undefined);

  // Get channel data
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('/api/channels', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setChannels(data.channels);

          // Get joined channel IDs
          const joined = data.channels
            .filter((channel: ApiChannel) => channel.isJoined)
            .map((channel: ApiChannel) => channel.id);
          setJoinedChannels(joined);

          // If no channel is selected, select the first joined channel
          if (!selectedChannel && joined.length > 0) {
            setSelectedChannel(joined[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching channels:', error);
      }
    };

    if (user) {
      fetchChannels();
    }
  }, [user, selectedChannel]);

  // Get user data
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (user) {
      fetchUsers();
    }
  }, [user]);

  // Listen for route changes and sync state
  useEffect(() => {
    if (userId && users.length > 0) {
      const member = users.find(u => u.id === userId);
      if (member) {
        setSelectedChat(userId);
        setSelectedChannel(undefined);
        setCurrentView('channel');
        console.log('🔄 [DEBUG] Route state sync - switching to DM:', userId);
      }
    } else if (!userId) {
      // If no userId parameter and currently in DM mode, switch back to channel mode
      if (selectedChat) {
        setSelectedChat(undefined);
        console.log('🔄 [DEBUG] Route state sync - switching to channel mode');
      }
    }
  }, [userId, users, selectedChat]);

  // Listen for channel value in URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const channelParam = searchParams.get('channel');
    const viewParam = searchParams.get('view');

    if (channelParam) {
      console.log('🎯 [DEBUG] Channel parameter detected:', channelParam);
      // Check if channel is joined
      if (joinedChannels.includes(channelParam)) {
        setSelectedChannel(channelParam);
        setSelectedChat(undefined);
        setCurrentView('channel');
        console.log('✅ [DEBUG] Channel selected:', channelParam);
      } else {
        console.log('⚠️ [DEBUG] Channel not joined or does not exist:', channelParam);
      }
    }

    if (viewParam === 'browse') {
      setCurrentView('browse');
      setSelectedChat(undefined);
      console.log('🔍 [DEBUG] Switching to browse channels view');
    }
  }, [joinedChannels]);

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
      console.error('Logout failed:', err);
    }
  };

  const handleStartChat = async (memberId: string, dmConversationId?: string) => {
    try {
      // === Step 1: Immediate optimistic update ===
      // Update selected DM state and highlight immediately
      setSelectedChat(memberId);
      // Clear selected channel
      setSelectedChannel(undefined);

      // === Step 2: Immediate page navigation ===
      // Use router.push for navigation (still use memberId path to be compatible with existing routes)
      const targetUrl = `/dm/${memberId}`;
      router.push(targetUrl);

      // === Step 3: Create/get conversation in background (non-blocking) ===
      // If conversationId is not provided, create or get DM conversation
      if (!dmConversationId) {
        const createConversation = async () => {
          try {
            const resp = await fetch('/api/conversations/dm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ userId: memberId })
            });

            if (resp.ok) {
              const conversation = await resp.json();

              // Dispatch global event to notify DirectMessages to optimistically add new conversation
              try {
                window.dispatchEvent(new CustomEvent('dm-created', { detail: conversation }));
              } catch (e) {
                console.warn('Cannot dispatch dm-created event', e);
              }
            }
          } catch (err) {
            console.error('Background conversation creation failed:', err);
          }
        };

        // Return immediately without waiting for result
        createConversation();
      }
    } catch (err) {
      console.error('Error starting DM:', err);
      // Even if there's an error, ensure state update and navigation
      setSelectedChat(memberId);
      setSelectedChannel(undefined);
      router.push(`/dm/${memberId}`);
    }
  };

  const handleNewChat = () => {
    console.log('Open new chat dialog');
    setIsNewDMModalOpen(true);
  };

  const handleSelectMemberFromModal = (memberId: string) => {
    console.log('🟡 [DEBUG] Select member from modal:', memberId);
    handleStartChat(memberId);
  };

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannel(channelId);
    setSelectedChat(undefined); // Clear selected DM
    setCurrentView('channel');

    // Clean up URL parameters to avoid interference with subsequent channel switching
    const url = new URL(window.location.href);
    url.searchParams.delete('channel');
    url.searchParams.delete('view');
    router.replace(url.pathname + url.search);
    console.log('🧹 [DEBUG] Clean up URL parameters');
  };

  const handleCreateChannel = (newChannel: ChannelType) => {
    // Convert Channel type to ApiChannel type
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
    setJoinedChannels(prev => [...prev, apiChannel.id]); // Auto-join newly created channel
    setSelectedChannel(apiChannel.id);

    // Clean up URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('channel');
    url.searchParams.delete('view');
    router.replace(url.pathname + url.search);

    console.log('Create new channel:', apiChannel);
  };

  const handleJoinChannel = async (channelId: string) => {
    // 1. Show loading state to prevent duplicate clicks
    setIsJoiningChannel(channelId);

    try {
      // 2. Call join channel API
      const response = await fetch(`/api/channels/${channelId}/join`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join channel');
      }

      const data = await response.json();
      console.log('✅ Successfully joined channel:', data);

      // 3. API success, update frontend state
      setJoinedChannels(prev => [...prev, channelId]);
      setCurrentView('channel');
      setSelectedChannel(channelId);

      // 4. Clean up URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('channel');
      url.searchParams.delete('view');
      router.replace(url.pathname + url.search);

      console.log('✅ Join channel complete:', channelId);
    } catch (error) {
      console.error('❌ Join channel failed:', error);
      // Show error message
      alert(`Failed to join channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // 5. Clear loading state
      setIsJoiningChannel(undefined);
    }
  };

  const handleLeaveChannel = async (channelId: string) => {
    // 1. Show loading state
    setIsJoiningChannel(channelId);

    try {
      // 2. Call leave channel API
      const response = await fetch(`/api/channels/${channelId}/leave`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to leave channel');
      }

      console.log('✅ Successfully left channel:', channelId);

      // 3. API success, update frontend state
      setJoinedChannels(prev => prev.filter(id => id !== channelId));

      // 4. If the left channel is the currently selected channel, switch to another channel
      if (selectedChannel === channelId) {
        const generalChannel = channels.find(c => c.id === 'channel-1');
        if (generalChannel && joinedChannels.includes(generalChannel.id)) {
          setSelectedChannel(generalChannel.id);
        } else {
          // If #general is also left, select the first joined channel
          const firstJoined = joinedChannels.find(id => id !== channelId);
          if (firstJoined) {
            setSelectedChannel(firstJoined);
          } else {
            setSelectedChannel(undefined);
          }
        }
      }

      console.log('✅ Leave channel complete:', channelId);
    } catch (error) {
      console.error('❌ Leave channel failed:', error);
      // Show error message
      alert(`Failed to leave channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // 5. Clear loading state
      setIsJoiningChannel(undefined);
    }
  };

  const handleBrowseChannels = () => {
    setCurrentView('browse');
    setSelectedChat(undefined);
  };

  const handleShowMembers = (channelId: string) => {
    // Set selected channel
    setSelectedChannel(channelId);
    setSelectedChat(undefined);
    setCurrentView('channel');
    console.log('Show channel members:', channelId);
  };

  const handleClearMessages = (channelId: string) => {
    console.log('Clear channel messages:', channelId);
    // No additional logic needed here, API calls are already handled in ChannelView
    // May need to refresh message list or trigger refetch
  };

  const handleBackToChannel = () => {
    setCurrentView('channel');
    // Return to previously selected channel, or default to first one if none
    if (!selectedChannel && joinedChannels.length > 0) {
      setSelectedChannel(joinedChannels[0]);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  // Filter out current user to get other members
  // Convert User to TeamMember format for NewDirectMessageModal compatibility
  const availableMembers = users
    .filter(member => member.id !== user.id)
    .map(user => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      realName: user.realName,
      avatarUrl: user.avatarUrl,
      isOnline: user.isOnline,
      lastSeenAt: user.lastSeenAt
    }));

  // Convert ApiChannel to Channel type to match component expectations
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
      {/* Browse channels view */}
      {currentView === 'browse' ? (
        <BrowseChannels
          channels={convertedChannels}
          userId={user.id}
          onJoinChannel={handleJoinChannel}
          onLeaveChannel={handleLeaveChannel}
          onSelectChannel={handleSelectChannel}
          onBack={handleBackToChannel}
          isJoiningChannel={isJoiningChannel}
        />
      ) : (
        <>
          {/* Main content area - ChannelView now includes header */}
          <div className="flex-1 h-full bg-background">
            {selectedChannel ? (
              <ChannelView
                channel={convertedChannels.find(c => c.id === selectedChannel)!}
                isJoined={joinedChannels.includes(selectedChannel)}
                onJoinChannel={handleJoinChannel}
                onLeaveChannel={handleLeaveChannel}
                onStartChat={handleStartChat}
                onShowMembers={() => handleShowMembers(selectedChannel)}
                onClearMessages={() => handleClearMessages(selectedChannel)}
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
                    Select a member from the left to start a private chat
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
                    Start Chat
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
                  <h2 className="text-2xl font-semibold text-text-primary mb-2">Welcome to Slack</h2>
                  <p className="text-text-secondary mb-6">
                    Select a channel or member from the left to start chatting
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
                    Start Chat
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
