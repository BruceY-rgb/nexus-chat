import { useEffect } from "react";
import { useUnreadStore } from "../store/unreadStore";
import { useSocket } from "./useSocket";
import { useAuth } from "./useAuth";

export function useUnreadCount() {
  const {
    incrementUnread,
    decrementUnread,
    setUnread,
    clearUnread,
    setUnreadFromDB,
  } = useUnreadStore();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();

  // Load unread counts from database
  const loadUnreadCounts = async (retryCount = 0) => {
    try {
      console.log("📊 Loading unread counts from API...");
      const response = await fetch("/api/users/unread-counts", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Loaded unread counts:", data);
        setUnreadFromDB(data);
      } else if (response.status === 403) {
        // Permission error: user may not be a channel member
        console.warn(
          "⚠️ Permission denied for unread counts, may not be a channel member",
        );
        // Don't show error, instead delay retry (max 3 times)
        if (retryCount < 3) {
          setTimeout(
            () => {
              loadUnreadCounts(retryCount + 1);
            },
            1000 * (retryCount + 1),
          ); // Increasing delay
        }
      } else {
        console.error("❌ Failed to load unread counts:", response.status);
      }
    } catch (error) {
      console.error("❌ Failed to load unread counts:", error);
      // Network errors can also retry
      if (retryCount < 3) {
        setTimeout(
          () => {
            loadUnreadCounts(retryCount + 1);
          },
          1000 * (retryCount + 1),
        );
      }
    }
  };

  // Mark messages as read
  const markAsRead = async (channelId?: string, dmConversationId?: string) => {
    try {
      const response = await fetch("/api/messages/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          channelId,
          dmConversationId,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Clear local state
        if (channelId) {
          clearUnread(channelId);
        } else if (dmConversationId) {
          clearUnread(dmConversationId);
        }

        return data;
      } else if (response.status === 403) {
        // Permission error: user may not be a channel member
        console.warn(
          "⚠️ Permission denied when marking as read, may not be a channel member",
        );
        // Don't throw error, handle silently
        return null;
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
      // Network error doesn't throw, handle silently
      return null;
    }
  };

  // Load unread counts immediately when component mounts (not dependent on WebSocket)
  useEffect(() => {
    if (user?.id) {
      loadUnreadCounts();
    }
  }, [user?.id]);

  // Set up WebSocket listeners
  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    // Listen for unread count updates
    const handleUnreadUpdate = (data: {
      channelId?: string;
      dmConversationId?: string;
      unreadCount: number;
    }) => {
      const { channelId, dmConversationId, unreadCount } = data;

      // Set unread count (backend already excluded sender, just set it directly)
      if (channelId) {
        setUnread(channelId, unreadCount);
      } else if (dmConversationId) {
        setUnread(dmConversationId, unreadCount);
      }
    };

    // Listen for new messages
    const handleNewMessage = (message: any) => {
      const { channelId, dmConversationId, userId } = message;

      // If it's not a message sent by current user, increment unread count
      if (channelId && userId !== user?.id) {
        incrementUnread(channelId);
      } else if (dmConversationId && userId !== user?.id) {
        incrementUnread(dmConversationId);
      }
    };

    socket.on("unread-count-update", handleUnreadUpdate);
    socket.on("new-message", handleNewMessage);

    // Cleanup function
    return () => {
      socket.off("unread-count-update", handleUnreadUpdate);
      socket.off("new-message", handleNewMessage);
    };
  }, [socket, isConnected, user?.id, incrementUnread, setUnread]);

  return {
    loadUnreadCounts,
    markAsRead,
    incrementUnread,
    setUnread,
    clearUnread,
  };
}
