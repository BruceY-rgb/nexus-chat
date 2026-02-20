import { useEffect, useRef, useCallback, useState } from "react";
import { useSocket } from "./useSocket";
import { Message } from "@/types/message";

interface UseWebSocketMessagesProps {
  dmConversationId?: string;
  channelId?: string;
  currentUserId: string;
  onNewMessage?: (message: Message) => void;
  onMessageUpdated?: (message: Message) => void;
  onMessageDeleted?: (data: {
    id: string;
    channelId?: string;
    dmConversationId?: string;
    isDeleted: boolean;
    deletedAt?: string;
  }) => void;
  isAtBottom?: boolean;
  shouldAutoScroll?: boolean;
}

interface WebSocketDebugInfo {
  isConnected: boolean;
  socketId?: string;
  currentRoom?: string;
  messagesReceived: number;
  lastMessageAt?: Date;
  connectionErrors: string[];
}

export function useWebSocketMessages({
  dmConversationId,
  channelId,
  currentUserId,
  onNewMessage,
  onMessageUpdated,
  onMessageDeleted,
  isAtBottom = true,
  shouldAutoScroll = true,
}: UseWebSocketMessagesProps) {
  const { socket, isConnected } = useSocket();
  const hasJoinedRoom = useRef(false);
  const previousMessageIds = useRef<Set<string>>(new Set());
  const joinAttempts = useRef(0);
  const maxJoinAttempts = 3;
  const joinRetryTimeout = useRef<NodeJS.Timeout | null>(null);

  // Use useRef to store callback functions to avoid dependency array changes
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageUpdatedRef = useRef(onMessageUpdated);
  const onMessageDeletedRef = useRef(onMessageDeleted);

  // Safely update callback function references
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    onMessageUpdatedRef.current = onMessageUpdated;
  }, [onMessageUpdated]);

  useEffect(() => {
    onMessageDeletedRef.current = onMessageDeleted;
  }, [onMessageDeleted]);

  // Debug info
  const [debugInfo] = useState<WebSocketDebugInfo>({
    isConnected: false,
    messagesReceived: 0,
    connectionErrors: [],
  });

  // Debug log function - optimized version: reduce dependency changes
  const log = useCallback(
    (level: "info" | "warn" | "error", message: string, data?: any) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [WebSocket] ${message}`;
      console[level](logMessage, data);
    },
    [],
  ); // Empty dependency array to ensure stable function reference

  // Protection mechanism to prevent duplicate initialization
  const [isInitialized, setIsInitialized] = useState(false);

  // Join room (with retry mechanism) - optimized version: reduce dependency changes
  const joinRoom = useCallback(
    (attempt = 1) => {
      const roomId = dmConversationId || channelId;
      if (!roomId) {
        log("info", "No room ID provided, skipping join");
        return;
      }

      // Check if socket is ready
      if (!socket) {
        log(
          "warn",
          `Socket not available for joining room ${roomId} (attempt ${attempt}/${maxJoinAttempts})`,
        );
        if (attempt < maxJoinAttempts) {
          joinRetryTimeout.current = setTimeout(() => {
            joinRoom(attempt + 1);
          }, 200);
        }
        return;
      }

      // Use socket.connected instead of isConnected state
      if (!socket.connected) {
        log(
          "warn",
          `Socket not connected for joining room ${roomId} (attempt ${attempt}/${maxJoinAttempts})`,
        );
        if (attempt < maxJoinAttempts) {
          joinRetryTimeout.current = setTimeout(() => {
            joinRoom(attempt + 1);
          }, 200);
        }
        return;
      }

      log(
        "info",
        `Attempting to join room: ${dmConversationId ? "DM" : "Channel"} ${roomId} (attempt ${attempt}/${maxJoinAttempts})`,
      );

      if (dmConversationId) {
        socket.emit("join-dm", dmConversationId);
        log(
          "info",
          `✅ Successfully emitted join-dm event for room: ${dmConversationId}`,
        );
      } else if (channelId) {
        socket.emit("join-channel", channelId);
        log(
          "info",
          `✅ Successfully emitted join-channel event for room: ${channelId}`,
        );
      }
      hasJoinedRoom.current = true;
      joinAttempts.current = 0;
    },
    [dmConversationId, channelId, log],
  ); // Remove socket dependency, use useRef to access

  // Leave room - optimized version: reduce dependency changes
  const leaveRoom = useCallback(() => {
    if (!socket || !hasJoinedRoom.current) {
      return;
    }

    // Clean up retry timer
    if (joinRetryTimeout.current) {
      clearTimeout(joinRetryTimeout.current);
      joinRetryTimeout.current = null;
    }

    if (dmConversationId) {
      console.log(`📤 [WebSocket] Leaving DM room: ${dmConversationId}`);
      socket.emit("leave-dm", dmConversationId);
    } else if (channelId) {
      console.log(`📤 [WebSocket] Leaving channel room: ${channelId}`);
      socket.emit("leave-channel", channelId);
    }

    hasJoinedRoom.current = false;
    joinAttempts.current = 0;
  }, [dmConversationId, channelId]); // Remove socket dependency

  // Listen for new messages - fixed version: only depend on socket instance to avoid frequent remounting
  useEffect(() => {
    log("info", `Setting up message listeners. Socket: ${!!socket}`);

    if (!socket) {
      log("warn", "Socket not available, message listeners not set up");
      return;
    }

    const handleNewMessage = (message: Message) => {
      log("info", `📨 Raw new-message event received:`, message);

      // Verify message belongs to current room
      const isForCurrentRoom =
        (dmConversationId && message.dmConversationId === dmConversationId) ||
        (channelId && message.channelId === channelId);

      log("info", `Message room validation:`, {
        messageDM: message.dmConversationId,
        expectedDM: dmConversationId,
        messageChannel: message.channelId,
        expectedChannel: channelId,
        isForCurrentRoom,
      });

      if (!isForCurrentRoom) {
        log("info", `Message ignored - not for current room`);
        return;
      }

      // Prevent duplicate messages (by message ID check)
      if (previousMessageIds.current.has(message.id)) {
        log("info", `⚠️ Duplicate message ignored: ${message.id}`);
        return;
      }

      // Store message ID
      previousMessageIds.current.add(message.id);

      // Limit history size (keep max 100 message IDs)
      if (previousMessageIds.current.size > 100) {
        const firstId = previousMessageIds.current.values().next().value;
        if (firstId) {
          previousMessageIds.current.delete(firstId);
        }
      }

      log("info", `✅ Message accepted and will be processed:`, {
        messageId: message.id,
        content: message.content?.substring(0, 50),
        fromUser: message.userId,
      });

      // Call callback function - use ref to avoid dependency changes
      if (onNewMessageRef.current) {
        log("info", `Calling onNewMessage callback`);
        onNewMessageRef.current(message);
      } else {
        log("warn", "No onNewMessage callback provided");
      }
    };

    // Listen for message updates
    const handleMessageUpdated = (updatedMessage: Message) => {
      const isForCurrentRoom =
        (dmConversationId &&
          updatedMessage.dmConversationId === dmConversationId) ||
        (channelId && updatedMessage.channelId === channelId);

      if (!isForCurrentRoom) {
        return;
      }

      log("info", `📝 Message updated:`, updatedMessage);

      if (onMessageUpdatedRef.current) {
        onMessageUpdatedRef.current(updatedMessage);
      }
    };

    // Listen for message deletion
    const handleMessageDeleted = (deleteData: {
      id: string;
      channelId?: string;
      dmConversationId?: string;
      isDeleted: boolean;
      deletedAt?: string;
    }) => {
      const { id } = deleteData;
      log("info", `🗑️ Message deleted:`, deleteData);

      if (onMessageDeletedRef.current) {
        onMessageDeletedRef.current(deleteData);
      }
    };

    // Listen for thread reply creation - convert to standard new-message event
    const handleThreadReplyCreated = (data: {
      threadId: string;
      message: Message;
      replyCount: number;
    }) => {
      log("info", `🧵 Thread reply created:`, data);

      // Verify thread reply belongs to current room
      const isForCurrentRoom =
        (dmConversationId &&
          data.message.dmConversationId === dmConversationId) ||
        (channelId && data.message.channelId === channelId);

      log("info", `🔍 Room validation for thread reply:`, {
        dmConversationId,
        channelId,
        messageDM: data.message.dmConversationId,
        messageChannel: data.message.channelId,
        isForCurrentRoom,
      });

      if (!isForCurrentRoom) {
        log("info", `Thread reply ignored - not for current room`);
        return;
      }

      // Prevent duplicate messages
      if (previousMessageIds.current.has(data.message.id)) {
        log("info", `⚠️ Duplicate thread reply ignored: ${data.message.id}`);
        return;
      }

      // Store message ID
      previousMessageIds.current.add(data.message.id);

      // Limit history size
      if (previousMessageIds.current.size > 100) {
        const firstId = previousMessageIds.current.values().next().value;
        if (firstId) {
          previousMessageIds.current.delete(firstId);
        }
      }

      // Convert to standard new-message event and call callback
      if (onNewMessageRef.current) {
        log(
          "info",
          `✅ Calling onNewMessage callback for thread reply: ${data.message.id}`,
        );
        onNewMessageRef.current(data.message);
      } else {
        log("warn", `❌ No onNewMessage callback available for thread reply`);
      }
    };

    // Register event listeners
    log("info", "Registering socket event listeners...");
    socket.on("new-message", handleNewMessage);
    socket.on("message-updated", handleMessageUpdated);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("thread-reply-created", handleThreadReplyCreated);
    log("info", "✅ Socket event listeners registered successfully");

    // Cleanup function
    return () => {
      log("info", "Cleaning up socket event listeners...");
      socket.off("new-message", handleNewMessage);
      socket.off("message-updated", handleMessageUpdated);
      socket.off("message-deleted", handleMessageDeleted);
      socket.off("thread-reply-created", handleThreadReplyCreated);
      log("info", "✅ Socket event listeners cleaned up");
    };
  }, [socket, dmConversationId, channelId]); // Key fix: remove isConnected dependency, only depend on socket and room ID

  // When room ID changes, rejoin room - optimized version: reduce dependency changes
  useEffect(() => {
    const roomId = dmConversationId || channelId;
    log("info", `🔄 Room ID changed, preparing to join:`, {
      dmConversationId,
      channelId,
      roomId,
      previousRoomJoined: hasJoinedRoom.current,
    });

    if (!roomId) {
      log("info", "No room ID provided, skipping room join");
      return;
    }

    // Reset room state and retry counter
    hasJoinedRoom.current = false;
    joinAttempts.current = 0;

    // Clean up previous retry timer
    if (joinRetryTimeout.current) {
      clearTimeout(joinRetryTimeout.current);
      joinRetryTimeout.current = null;
    }

    // Delay a bit to join, ensure component is fully mounted
    const timer = setTimeout(() => {
      log("info", `⏰ Delayed join room triggered for: ${roomId}`);
      joinRoom(1); // Use joinRoom function with retry
    }, 100);

    return () => {
      clearTimeout(timer);
      log("info", `🏠 Cleaning up room: ${roomId}`);
      if (socket && hasJoinedRoom.current) {
        if (dmConversationId) {
          socket.emit("leave-dm", dmConversationId);
        } else if (channelId) {
          socket.emit("leave-channel", channelId);
        }
        hasJoinedRoom.current = false;
      }
      // Clean up retry timer
      if (joinRetryTimeout.current) {
        clearTimeout(joinRetryTimeout.current);
        joinRetryTimeout.current = null;
      }
    };
  }, [dmConversationId, channelId]); // Only depend on room ID, significantly reduce remounting

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      leaveRoom();
      previousMessageIds.current.clear();
      // Clean up retry timer
      if (joinRetryTimeout.current) {
        clearTimeout(joinRetryTimeout.current);
        joinRetryTimeout.current = null;
      }
    };
  }, [leaveRoom]);

  return {
    joinRoom,
    leaveRoom,
    isConnected,
  };
}
