'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TeamMember } from '@/types';
import { Channel } from '@/types/channel';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui';
import DirectMessageView from '@/components/DirectMessageView';

// Type definition - matching API response data format
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

export default function DirectMessagePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [member, setMember] = useState<TeamMember | null>(null);
  const [channels, setChannels] = useState<ApiChannel[]>([]);
  const [joinedChannels, setJoinedChannels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (userId) {
      fetchMember();
    }
  }, [userId, user, loading, router]);

  // Fetch channel data
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('/api/channels', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setChannels(data.channels || []);

          // Get joined channel IDs
          const joined = data.channels
            .filter((channel: ApiChannel) => channel.isJoined)
            .map((channel: ApiChannel) => channel.id);
          setJoinedChannels(joined);
        }
      } catch (error) {
        console.error('Error fetching channels:', error);
      }
    };

    if (user) {
      fetchChannels();
    }
  }, [user]);

  const fetchMember = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/users?userId=${userId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const foundMember = data.users?.find((m: TeamMember) => m.id === userId);
        setMember(foundMember || null);

        if (!foundMember) {
          router.push('/dashboard');
        }
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching member:', error);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || !user || (isLoading && !member)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  const handleStartChat = (memberId: string) => {
    console.log('🟡 [DEBUG] Click private chat member:', memberId);
    router.push(`/dm/${memberId}`);
  };

  const handleNewChat = () => {
    console.log('Open new chat dialog');
  };

  const handleLogout = async () => {
    router.push('/login');
  };

  const handleSelectChannel = (channelId: string) => {
    // Switch to channel view
    router.push(`/dashboard?channel=${channelId}`);
  };

  const handleBrowseChannels = () => {
    router.push('/dashboard?view=browse');
  };

  // Convert ApiChannel to Channel type
  const convertedChannels: Channel[] = channels.map(channel => ({
    id: channel.id,
    name: channel.name,
    description: channel.description,
    type: channel.isPrivate ? 'private' as const : 'public' as const,
    createdAt: channel.createdAt,
    ownerId: channel.createdBy.id,
    memberCount: channel.memberCount
  }));

  const content = member ? (
    <>
      {/* Private message content - render DirectMessageView directly */}
      <DirectMessageView member={member} currentUserId={user.id} />
    </>
  ) : null;

  return (
    <DashboardLayout
      channels={convertedChannels}
      selectedChannelId={undefined}
      joinedChannels={joinedChannels}
      selectedDirectMessageId={userId}
      onSelectChannel={handleSelectChannel}
      onCreateChannel={() => {}}
      onBrowseChannels={handleBrowseChannels}
      onStartChat={handleStartChat}
      onNewChat={handleNewChat}
      onLogout={handleLogout}
    >
      {content}
    </DashboardLayout>
  );
}
