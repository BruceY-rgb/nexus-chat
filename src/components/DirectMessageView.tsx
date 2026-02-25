"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TeamMember } from "../types";
import { Message, DMConversation } from "@/types/message";
import DMHeader from "./DMHeader";
import DMTabs from "./DMTabs";
import MySpaceView from "./MySpaceView";
import MessageList, { MessageListRef } from "./MessageList";
import DMMessageInput from "./DMMessageInput";
import ThreadPanel from "./ThreadPanel";
import FileList from "./FileList";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useWebSocketMessages } from "@/hooks/useWebSocketMessages";
import { useSocket } from "@/hooks/useSocket";
import { useThreadStore } from "@/stores/threadStore";

interface DirectMessageViewProps {
  member: TeamMember;
  currentUserId: string;
}

export default function DirectMessageView({
  member,
  currentUserId,
}: DirectMessageViewProps) {
  const isOwnSpace = member.id === currentUserId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<DMConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "messages" | "canvas" | "files" | "shared"
  >("messages");
  const { markAsRead } = useUnreadCount();
  const { socket, isConnected, connect, connectionStatus } = useSocket();
  const messageListRef = useRef<MessageListRef>(null);

  // Thread state management
  const {
    setActiveThread,
    activeThreadId,
    activeThreadMessage,
    threadPanelOpen,
    closeThread,
  } = useThreadStore();

  // Quoted message state
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);

  // Input height state
  const [inputHeight, setInputHeight] = useState(180); // Default height - increased to show all buttons
  const [isResizingInput, setIsResizingInput] = useState(false);
  const inputDragStart = useRef({ y: 0, height: 180 });

  // Input drag handling
  const handleInputDragStart = (e: React.MouseEvent) => {
    setIsResizingInput(true);
    inputDragStart.current = { y: e.clientY, height: inputHeight };
  };

  useEffect(() => {
    const handleInputDrag = (e: MouseEvent) => {
      if (!isResizingInput) return;
      const deltaY = inputDragStart.current.y - e.clientY; // Increase height when dragging up
      const newHeight = Math.max(
        60,
        Math.min(400, inputDragStart.current.height + deltaY),
      );
      setInputHeight(newHeight);
    };

    const handleInputDragEnd = () => {
      setIsResizingInput(false);
    };

    if (isResizingInput) {
      document.addEventListener("mousemove", handleInputDrag);
      document.addEventListener("mouseup", handleInputDragEnd);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleInputDrag);
      document.removeEventListener("mouseup", handleInputDragEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingInput]);

  // Handle quoted message
  const handleQuote = useCallback((message: Message) => {
    setQuotedMessage(message);
  }, []);

  // Clear quoted message
  const handleClearQuote = useCallback(() => {
    setQuotedMessage(null);
  }, []);

  // Track if at bottom of message list
  const isAtBottomRef = useRef(true);

  // Listen for messageId parameter in URL for deep linking
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const messageId = urlParams.get("messageId");

    if (messageId) {
      // Add retry mechanism for when messageListRef is not ready yet
      const highlightWithRetry = (retries = 10) => {
        if (messageListRef.current) {
          messageListRef.current.highlightMessage(messageId);

          // Clear messageId parameter from URL to avoid duplicate highlight on refresh
          const newUrl =
            window.location.pathname +
            window.location.search.replace(/[?&]messageId=[^&]*/, "");
          window.history.replaceState({}, "", newUrl);
        } else if (retries > 0) {
          // Retry after a short delay
          setTimeout(() => highlightWithRetry(retries - 1), 200);
        }
      };

      highlightWithRetry();
    }
  }, [member.id]);

  // Listen for search-navigate-to-message event from GlobalSearchModal
  useEffect(() => {
    const handleSearchNavigate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.messageId || !messageListRef.current) return;

      const highlightWithRetry = (retries = 10) => {
        if (messageListRef.current) {
          messageListRef.current.highlightMessage(detail.messageId);
        } else if (retries > 0) {
          setTimeout(() => highlightWithRetry(retries - 1), 200);
        }
      };

      highlightWithRetry();
    };

    window.addEventListener("search-navigate-to-message", handleSearchNavigate);
    return () => {
      window.removeEventListener("search-navigate-to-message", handleSearchNavigate);
    };
  }, []);

  // Force connect WebSocket (if not connected)
  useEffect(() => {
    console.log(`🔌 [DirectMessageView] WebSocket Status Check:`, {
      socketExists: !!socket,
      isConnected,
      socketId: socket?.id,
    });

    if (!socket || !isConnected) {
      console.log(`🔌 [DirectMessageView] Force connecting WebSocket...`);
      connect();
    }
  }, [socket, isConnected, connect]);

  // Handle scroll position change
  const handleScrollPositionChange = (isAtBottom: boolean) => {
    isAtBottomRef.current = isAtBottom;
  };

  // Handle thread reply
  const handleThreadReply = useCallback(
    (message: Message) => {
      // Set active thread and open thread panel
      setActiveThread(message.id, message);
    },
    [setActiveThread],
  );

  // ESC key to close thread panel
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeThreadId) {
        setActiveThread(null);
      }
    };

    window.addEventListener("keydown", handleEscKey);
    return () => {
      window.removeEventListener("keydown", handleEscKey);
    };
  }, [activeThreadId, setActiveThread]);

  // WebSocket message listener
  const handleNewMessage = (newMessage: Message) => {
    console.log(
      "📨 [DirectMessageView] 🔥 CRITICAL: New message received via WebSocket!",
      {
        messageId: newMessage.id,
        content: newMessage.content?.substring(0, 50),
        fromUser: newMessage.userId,
        dmConversationId: newMessage.dmConversationId,
        expectedConversationId: conversation?.id,
        currentUserId,
        timestamp: new Date().toISOString(),
      },
    );

    // Try to update UI immediately
    setMessages((prev) => {
      console.log(
        `📨 [DirectMessageView] Current message count: ${prev.length}`,
      );

      // Prevent duplicate messages
      if (prev.some((msg) => msg.id === newMessage.id)) {
        console.log(
          "⚠️ [DirectMessageView] Duplicate message detected, ignoring:",
          newMessage.id,
        );
        return prev;
      }

      const updated = [...prev, newMessage];
      console.log(
        `✅ [DirectMessageView] Message added to state. New count: ${updated.length}`,
      );

      // Auto scroll to bottom (only when user is already at bottom)
      if (isAtBottomRef.current) {
        console.log(
          "📜 [DirectMessageView] User is at bottom, auto-scrolling to new message",
        );
        setTimeout(() => {
          const messagesEndElement =
            document.querySelector("#messages-end-ref");
          if (messagesEndElement) {
            console.log("📜 [DirectMessageView] Auto-scroll triggered");
            messagesEndElement.scrollIntoView({ behavior: "smooth" });
          } else {
            console.log(
              "⚠️ [DirectMessageView] Scroll anchor element not found",
            );
          }
        }, 100);
      } else {
        console.log(
          "📜 [DirectMessageView] User is not at bottom, skipping auto-scroll",
        );
      }

      return updated;
    });

    console.log("✅ [DirectMessageView] Message processing completed");
  };

  // Get or create DM conversation
  const fetchConversation = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/conversations/dm/${member.id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch conversation");
      }

      const data = await response.json();
      setConversation(data);

      // If real conversation (non self-), clear unread count
      if (!isOwnSpace && data.id && !data.id.startsWith("self-")) {
        try {
          // Clear unread count for this conversation
          markAsRead(undefined, data.id);
        } catch (markAsReadError) {
          console.error("Error marking as read:", markAsReadError);
          // Even if markAsRead fails, message loading is not affected
        }
        fetchMessages(data.id);
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error fetching conversation:", err);
      setError("Failed to load conversation");
      setIsLoading(false);
    }
  };

  // Get message list
  const PAGE_SIZE = 50;

  const fetchMessages = async (conversationId: string) => {
    try {
      setIsLoading(true);
      setHasMore(true);
      const response = await fetch(
        `/api/messages?dmConversationId=${conversationId}&limit=${PAGE_SIZE}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = await response.json();
      setMessages(data.reverse());
      setHasMore(data.length >= PAGE_SIZE);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages");
      setIsLoading(false);
    }
  };

  const fetchOlderMessages = useCallback(async () => {
    if (!conversation?.id || isLoadingMore || !hasMore) return;

    try {
      setIsLoadingMore(true);
      const container = document.getElementById("messages-scroll-container");
      const prevScrollHeight = container?.scrollHeight || 0;

      const response = await fetch(
        `/api/messages?dmConversationId=${conversation.id}&limit=${PAGE_SIZE}&offset=${messages.length}`,
      );

      if (!response.ok) {
        setIsLoadingMore(false);
        return;
      }

      const data = await response.json();
      setHasMore(data.length >= PAGE_SIZE);
      if (data.length > 0) {
        setMessages((prev) => [...data.reverse(), ...prev]);
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      }
      setIsLoadingMore(false);
    } catch (err) {
      console.error("Error fetching older messages:", err);
      setIsLoadingMore(false);
    }
  }, [conversation?.id, isLoadingMore, hasMore, messages.length]);

  // Initial load
  useEffect(() => {
    fetchConversation();
  }, [member.id, isOwnSpace]);

  // Handle message edit
  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("Failed to edit message");
      }

      const updatedMessage = await response.json();

      // Optimistically update local message list
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? updatedMessage : msg)),
      );

      console.log("✅ Message edited successfully:", messageId);
    } catch (error) {
      console.error("❌ Failed to edit message:", error);
      throw error;
    }
  };

  // Handle message deletion
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete message");
      }

      const result = await response.json();

      // Optimistically update local message list (mark as deleted)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, isDeleted: true, deletedAt: result.data.deletedAt }
            : msg,
        ),
      );

      console.log("✅ Message deleted successfully:", messageId);
    } catch (error) {
      console.error("❌ Failed to delete message:", error);
      throw error;
    }
  };

  // Handle message update (from WebSocket)
  const handleMessageUpdated = (updatedMessage: Message) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)),
    );
  };

  // Handle message deletion (from WebSocket)
  const handleMessageDeleted = (deleteData: {
    id: string;
    channelId?: string;
    dmConversationId?: string;
    isDeleted: boolean;
    deletedAt?: string;
  }) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === deleteData.id
          ? { ...msg, isDeleted: true, deletedAt: deleteData.deletedAt }
          : msg,
      ),
    );
  };

  // WebSocket message listener
  // Only start listening after conversation is loaded to ensure using real room ID
  const shouldUseWebSocket =
    !isOwnSpace && conversation && !conversation.id.startsWith("self-");
  useWebSocketMessages({
    dmConversationId: shouldUseWebSocket ? conversation.id : undefined,
    currentUserId,
    onNewMessage: handleNewMessage,
    onMessageUpdated: handleMessageUpdated,
    onMessageDeleted: handleMessageDeleted,
  });

  // Log WebSocket status
  useEffect(() => {
    if (!isOwnSpace) {
      console.log(`🔌 [DirectMessageView] WebSocket status:`, {
        shouldUseWebSocket,
        hasConversation: !!conversation,
        conversationId: conversation?.id,
        memberId: member.id,
      });
    }
  }, [shouldUseWebSocket, conversation, isOwnSpace, member.id]);

  // Handle message sent
  const handleMessageSent = useCallback((message?: Message) => {
    // If message object is received, perform optimistic update
    if (message) {
      console.log(
        "✅ [DirectMessageView] Message sent successfully, performing optimistic update:",
        message.id,
      );
      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some((msg) => msg.id === message.id)) {
          console.log(
            "⚠️ [DirectMessageView] Duplicate message in optimistic update, ignoring:",
            message.id,
          );
          return prev;
        }
        return [...prev, message];
      });
    } else {
      console.log(
        "✅ [DirectMessageView] Message sent via API, WebSocket will handle real-time update",
      );
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* 1. Top Header - Fixed */}
      <div className="flex-shrink-0">
        <DMHeader member={member} currentUserId={currentUserId} />
      </div>

      {/* 2. Tab Navigation - Fixed */}
      <div className="flex-shrink-0">
        <DMTabs
          isOwnSpace={isOwnSpace}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* 3. Main content area: ensure it takes all remaining height */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Render different content based on activeTab */}
        {activeTab === "files" &&
        conversation &&
        !conversation.id.startsWith("self-") ? (
          <div className="flex-1 overflow-hidden">
            <FileList conversationId={conversation.id} conversationType="dm" />
          </div>
        ) : activeTab === "files" &&
          (!conversation || conversation.id.startsWith("self-")) ? (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            Please select a conversation to view files
          </div>
        ) : isOwnSpace ? (
          <div className="flex-1 overflow-y-auto">
            <MySpaceView member={member} currentUserId={currentUserId} />
          </div>
        ) : (
          <>
            {/* Message list and thread panel use flex layout to avoid overlapping causing event penetration */}
            <div className="flex flex-1 min-h-0">
              {/* Message list: must set flex-1 and min-h-0 to force fill space and support internal scrolling */}
              <div className="flex-1 min-w-0 min-h-0 relative">
                <MessageList
                  ref={messageListRef}
                  messages={messages}
                  currentUserId={currentUserId}
                  isLoading={isLoading}
                  isLoadingMore={isLoadingMore}
                  hasMore={hasMore}
                  onLoadMore={fetchOlderMessages}
                  className="h-full w-full"
                  dmConversationId={
                    conversation?.id && !conversation.id.startsWith("self-")
                      ? conversation.id
                      : undefined
                  }
                  onScrollPositionChange={handleScrollPositionChange}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onThreadReply={handleThreadReply}
                  onQuote={handleQuote}
                />
              </div>

              {/* Thread panel: right slide-out panel, width 360px */}
              {threadPanelOpen && (
                <ThreadPanel
                  isOpen={threadPanelOpen}
                  onClose={closeThread}
                  threadMessage={activeThreadMessage}
                  currentUserId={currentUserId}
                />
              )}
            </div>

            {error && (
              <div className="flex-shrink-0 p-4 bg-red-500/10 text-red-500 text-center">
                {error}
              </div>
            )}

            {/* 4. Input: use flex-shrink-0 to ensure it is pushed to the bottom, never moves up */}
            <div className="flex-shrink-0 bg-background border-t relative">
              {/* Top drag area */}
              <div
                className="absolute left-0 top-0 right-0 h-1 cursor-row-resize hover:bg-primary/50 transition-colors"
                onMouseDown={handleInputDragStart}
                style={{
                  cursor: isResizingInput ? "row-resize" : "row-resize",
                }}
              />
              <div
                style={{
                  height: `${inputHeight}px`,
                  transition: isResizingInput ? 'none' : 'height 0.2s ease-out'
                }}
                className="p-4 overflow-hidden"
              >
                <DMMessageInput
                  placeholder={`Message ${member.displayName}`}
                  disabled={
                    isLoading ||
                    !conversation ||
                    conversation.id.startsWith("self-")
                  }
                  dmConversationId={
                    conversation?.id && !conversation.id.startsWith("self-")
                      ? conversation.id
                      : undefined
                  }
                  currentUserId={currentUserId}
                  members={[member]}
                  onMessageSent={handleMessageSent}
                  quotedMessage={quotedMessage}
                  onClearQuote={handleClearQuote}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
