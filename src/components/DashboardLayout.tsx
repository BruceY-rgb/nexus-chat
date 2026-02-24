"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Button, Avatar } from "@/components/ui";
import DirectMessages from "@/components/DirectMessages";
import Channels from "@/components/Channels";
import { TeamMember } from "@/types";
import { Channel } from "@/types/channel";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useUnreadStore } from "@/store/unreadStore";
import { useMarkAllAsRead } from "@/hooks/useMarkAllAsRead";
import { LogOut, Settings, CheckCheck } from "lucide-react";
import SearchBox from "@/components/SearchBox";

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
  onLogout,
}: DashboardLayoutProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Left sidebar width state
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px (w-64)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarDragStart = useRef({ x: 0, width: 256 });

  // Left sidebar drag handling
  const handleSidebarDragStart = (e: React.MouseEvent) => {
    setIsResizingSidebar(true);
    sidebarDragStart.current = { x: e.clientX, width: sidebarWidth };
  };

  useEffect(() => {
    const handleSidebarDrag = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const deltaX = e.clientX - sidebarDragStart.current.x;
      const newWidth = Math.max(
        180,
        Math.min(400, sidebarDragStart.current.width + deltaX),
      );
      setSidebarWidth(newWidth);
    };

    const handleSidebarDragEnd = () => {
      setIsResizingSidebar(false);
    };

    if (isResizingSidebar) {
      document.addEventListener("mousemove", handleSidebarDrag);
      document.addEventListener("mouseup", handleSidebarDragEnd);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleSidebarDrag);
      document.removeEventListener("mouseup", handleSidebarDragEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingSidebar]);

  // Initialize unread count system
  const { markAsRead } = useUnreadCount();
  const { totalUnreadCount } = useUnreadStore();
  const { markAllAsRead, isLoading: isMarkingAllRead } = useMarkAllAsRead();

  // Debug: print unread count state
  useEffect(() => {
    console.log("📊 DashboardLayout - Total unread count:", totalUnreadCount);
  }, [totalUnreadCount]);

  // When selecting a channel, clear unread count
  const handleSelectChannel = (channelId: string) => {
    console.log("📖 Marking channel as read:", channelId);
    markAsRead(channelId);
    onSelectChannel?.(channelId);
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (totalUnreadCount === 0) return;
    try {
      const result = await markAllAsRead();
      console.log("✅ Marked all as read:", result);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  // When starting a chat, clear unread count
  const handleStartChat = (memberId: string, dmConversationId?: string) => {
    // Use passed dmConversationId, or fallback to memberId
    const conversationId = dmConversationId || memberId;

    console.log("📖 Marking DM as read:", { memberId, conversationId });
    markAsRead(undefined, conversationId);
    onStartChat?.(memberId, dmConversationId);
  };

  // Get team member list
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch("/api/users", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setTeamMembers(data.users || []);
        }
      } catch (error) {
        console.error("Error fetching team members:", error);
      }
    };

    fetchTeamMembers();
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-full">
        {/* Left sidebar */}
        <div
          className="h-full bg-slack-purple flex flex-col relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          {/* Right drag area */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30 transition-colors"
            onMouseDown={handleSidebarDragStart}
            style={{ cursor: isResizingSidebar ? "col-resize" : "col-resize" }}
          />

          {/* Top user info - fixed, no scroll */}
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
                <p className="text-white text-sm font-medium truncate">
                  {user?.displayName}
                </p>
                <p className="text-white/60 text-xs truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/profile")}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Search box */}
          <div className="flex-shrink-0 px-3 py-2">
            <SearchBox />
          </div>

          {/* Mark all as read button */}
          {totalUnreadCount > 0 && (
            <div className="flex-shrink-0 px-2 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAllRead}
                className="w-full text-white/70 hover:text-white hover:bg-white/10 justify-start text-xs"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                {isMarkingAllRead
                  ? "Marking..."
                  : `Mark all as read (${totalUnreadCount})`}
              </Button>
            </div>
          )}

          {/* Channels and direct messages list - independent scroll */}
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
              currentUserId={user?.id || ""}
              selectedDirectMessageId={selectedDirectMessageId}
              onStartChat={handleStartChat}
              onNewChat={onNewChat}
            />
          </div>

          {/* Bottom logout button - fixed, no scroll */}
          <div className="flex-shrink-0 p-4 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={onLogout}
              className="w-full text-white/70 hover:text-white hover:bg-white/10 justify-start"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </div>
        </div>

        {/* Right main content area */}
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
