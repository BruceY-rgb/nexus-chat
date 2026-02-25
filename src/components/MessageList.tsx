"use client";

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from "react";
import { useSearchParams } from "next/navigation";
import { Message } from "@/types/message";
import { format, formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import MessageItem from "./MessageItem";
import { useReadProgress } from "@/hooks/useReadProgress";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
  channelId?: string;
  dmConversationId?: string;
  onScrollPositionChange?: (isAtBottom: boolean) => void;
  onEditMessage?: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onThreadReply?: (message: Message) => void;
  onQuote?: (message: Message) => void;
  members?: { id: string; displayName: string }[];
}

export interface MessageListRef {
  highlightMessage: (messageId: string) => void;
}

const MessageList = forwardRef<MessageListRef, MessageListProps>(
  (
    {
      messages,
      currentUserId,
      isLoading = false,
      isLoadingMore = false,
      hasMore = false,
      onLoadMore,
      className = "",
      channelId,
      dmConversationId,
      onScrollPositionChange,
      onEditMessage,
      onDeleteMessage,
      onThreadReply,
      onQuote,
      members,
    },
    ref,
  ) => {
    const searchParams = useSearchParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const isInitialLoadRef = useRef(true);
    const prevChannelRef = useRef(channelId);
    const prevDmRef = useRef(dmConversationId);

    // Stable snapshot: captures the first unread message ID once on channel entry.
    // This does NOT change as the user scrolls — it stays fixed until dismissed.
    const initialUnreadMessageIdRef = useRef<string | null>(null);
    const snapshotTakenRef = useRef(false);
    // Guard: prevents programmatic scrolls from clearing unread UI.
    const userHasScrolledRef = useRef(false);

    // Reset flags when channel/conversation changes
    if (prevChannelRef.current !== channelId || prevDmRef.current !== dmConversationId) {
      isInitialLoadRef.current = true;
      initialUnreadMessageIdRef.current = null;
      snapshotTakenRef.current = false;
      userHasScrolledRef.current = false;
      prevChannelRef.current = channelId;
      prevDmRef.current = dmConversationId;
    }

    const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const [showReadIndicator] = useState<string | null>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<
      string | null
    >(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(
      null,
    );

    // Use read progress hook
    const { reportReadProgress, readPosition } = useReadProgress({
      channelId,
      dmConversationId,
      messages,
      messageRefs,
    });

    // Unread capsule status
    const [showUnreadBadge, setShowUnreadBadge] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const isAtBottomRef = useRef(false);
    const unreadDividerRef = useRef<HTMLDivElement>(null);
    // Flag to suppress userHasScrolled during programmatic scrolls
    const isProgrammaticScrollRef = useRef(false);

    // Take snapshot once when readPosition arrives from the API
    useEffect(() => {
      if (snapshotTakenRef.current) return;
      if (!readPosition || messages.length === 0) return;

      snapshotTakenRef.current = true;

      const lastReadId = readPosition.lastReadMessageId;
      if (!lastReadId) {
        // No read position means everything is unread — snapshot first message
        initialUnreadMessageIdRef.current = messages[0]?.id ?? null;
      } else if (lastReadId === messages[messages.length - 1]?.id) {
        // Already read everything — no unread
        initialUnreadMessageIdRef.current = null;
      } else {
        const lastReadIndex = messages.findIndex(m => m.id === lastReadId);
        if (lastReadIndex === -1 || lastReadIndex >= messages.length - 1) {
          initialUnreadMessageIdRef.current = null;
        } else {
          initialUnreadMessageIdRef.current = messages[lastReadIndex + 1]?.id ?? null;
        }
      }

      // Show badge if there are unread messages.
      // Don't check isAtBottomRef here — the programmatic scrollToBottom hasn't
      // run yet at this point, so the container may report any scroll position.
      if (initialUnreadMessageIdRef.current) {
        const firstUnreadIndex = messages.findIndex(m => m.id === initialUnreadMessageIdRef.current);
        if (firstUnreadIndex !== -1) {
          const count = messages.length - firstUnreadIndex;
          setUnreadCount(count);
          setShowUnreadBadge(true);
        }
      }
    }, [readPosition, messages]);

    // Use the stable snapshot for divider rendering (not live readPosition)
    const [unreadDividerMessageId, setUnreadDividerMessageId] = useState<string | null>(null);

    // Sync divider from snapshot
    useEffect(() => {
      setUnreadDividerMessageId(initialUnreadMessageIdRef.current);
    }, [readPosition, messages]);

    // Click unread capsule to scroll to unread position
    const scrollToFirstUnread = useCallback(() => {
      isProgrammaticScrollRef.current = true;
      if (unreadDividerRef.current) {
        unreadDividerRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      setShowUnreadBadge(false);
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 500);
    }, []);

    // Handle edit message - optimized with useCallback
    const handleEditMessage = useCallback(
      async (messageId: string, content: string) => {
        if (onEditMessage) {
          await onEditMessage(messageId, content);
          setEditingMessageId(null); // Exit edit mode
        }
      },
      [onEditMessage],
    );

    // Handle delete message - optimized with useCallback
    const handleDeleteMessage = useCallback(
      async (messageId: string) => {
        if (onDeleteMessage) {
          await onDeleteMessage(messageId);
        }
      },
      [onDeleteMessage],
    );

    // Start editing message - optimized with useCallback
    const startEditing = useCallback((message: Message) => {
      setEditingMessageId(message.id);
    }, []);

    // Cancel editing - optimized with useCallback
    const cancelEditing = useCallback(() => {
      setEditingMessageId(null);
    }, []);

    const scrollToBottom = useCallback((instant = false) => {
      isProgrammaticScrollRef.current = true;
      if (instant) {
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
      // Reset after a tick so the scroll event handler sees the flag
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 200);
    }, []);

    const scrollToMessage = useCallback(
      (messageId: string) => {
        const messageElement = messageRefs.current[messageId];
        if (messageElement) {
          messageElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          // Scroll positioning controlled by highlightedMessageId state for visual effect, no need to manipulate classList directly
        }
      },
      [messageRefs],
    );

    // Use useImperativeHandle to expose highlightMessage method
    useImperativeHandle(ref, () => ({
      highlightMessage: (messageId: string) => {
        // Clear any existing highlight timeouts
        setHighlightedMessageId(messageId);

        // Scroll to message with retry mechanism for stability
        const scrollWithRetry = (retries = 3) => {
          const messageElement = messageRefs.current[messageId];
          if (messageElement) {
            messageElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          } else if (retries > 0) {
            // Retry after a short delay if element not found yet
            setTimeout(() => scrollWithRetry(retries - 1), 100);
          }
        };

        // Start scrolling after a small delay to ensure rendering
        setTimeout(() => scrollWithRetry(), 150);

        // Auto clear highlight after 5 seconds (increased from 2s for better UX)
        setTimeout(() => {
          setHighlightedMessageId(null);
        }, 5000);
      },
    }));

    // Scroll position detection - check if user is at the bottom of message list
    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      let isAtBottom = false;
      let timeoutId: NodeJS.Timeout;

      const checkScrollPosition = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        // Check if at bottom (allow 100px tolerance)
        isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        isAtBottomRef.current = isAtBottom;

        // Only dismiss unread badge/divider when the USER has scrolled to bottom,
        // not from the programmatic initial scrollToBottom.
        if (isAtBottom && userHasScrolledRef.current) {
          setShowUnreadBadge(false);
          // Clear the snapshot so divider disappears too
          initialUnreadMessageIdRef.current = null;
          setUnreadDividerMessageId(null);
        }

        // Notify parent component of scroll position change
        if (onScrollPositionChange) {
          onScrollPositionChange(isAtBottom);
        }
      };

      // Scroll event handler
      const handleScroll = () => {
        // Don't mark as user scroll if it was triggered programmatically
        if (!isProgrammaticScrollRef.current) {
          userHasScrolledRef.current = true;
        }
        // Use debounce to avoid frequent triggers
        clearTimeout(timeoutId);
        timeoutId = setTimeout(checkScrollPosition, 50);
      };

      // Initial check — do NOT set userHasScrolledRef here
      checkScrollPosition();

      // Add scroll listener
      container.addEventListener("scroll", handleScroll, { passive: true });

      // Listen for message changes (may change container height)
      const resizeObserver = new ResizeObserver(() => {
        checkScrollPosition();
      });

      resizeObserver.observe(container);

      return () => {
        container.removeEventListener("scroll", handleScroll);
        resizeObserver.disconnect();
        clearTimeout(timeoutId);
      };
    }, [onScrollPositionChange, messages]);

    // Infinite scroll: load more when scrolling near top
    useEffect(() => {
      const sentinel = topSentinelRef.current;
      if (!sentinel || !onLoadMore || !hasMore || isLoadingMore) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onLoadMore();
          }
        },
        { rootMargin: "200px" },
      );

      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [onLoadMore, hasMore, isLoadingMore]);

    // Listen for scroll and automatically report read progress
    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          // Find the last visible message
          const visibleMessages = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => {
              // Sort by position, get the bottom-most message
              const rectA = a.target.getBoundingClientRect();
              const rectB = b.target.getBoundingClientRect();
              return rectB.top - rectA.top;
            });

          if (visibleMessages.length > 0) {
            const lastVisibleMessage = visibleMessages[0];
            const messageId =
              lastVisibleMessage.target.getAttribute("data-message-id");
            if (messageId) {
              reportReadProgress(messageId);
            }
          }
        },
        {
          threshold: 0.3, // Trigger when message is 30% visible
          rootMargin: "100px", // Start detection 100px early
        },
      );

      // Observe all message elements
      Object.entries(messageRefs.current).forEach(([messageId, element]) => {
        if (element) {
          element.setAttribute("data-message-id", messageId);
          observer.observe(element);
        }
      });

      return () => {
        observer.disconnect();
      };
    }, [messages, reportReadProgress]);

    useEffect(() => {
      // Check messageId parameter in URL
      const messageId = searchParams.get("messageId");
      if (messageId && messages.length > 0) {
        // Set highlight state
        setHighlightedMessageId(messageId);

        // Scroll to message with retry mechanism for stability
        const scrollWithRetry = (retries = 3) => {
          const messageElement = messageRefs.current[messageId];
          if (messageElement) {
            messageElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          } else if (retries > 0) {
            // Retry after a short delay if element not found yet
            setTimeout(() => scrollWithRetry(retries - 1), 100);
          }
        };

        // Delayed execution to ensure message is rendered
        setTimeout(() => scrollWithRetry(), 150);

        // Auto clear highlight after 5 seconds (increased from 2s for better UX)
        setTimeout(() => {
          setHighlightedMessageId(null);
        }, 5000);
      } else {
        // When no specific message, scroll to bottom only on initial load
        setHighlightedMessageId(null);
        if (isInitialLoadRef.current) {
          requestAnimationFrame(() => {
            scrollToBottom(true); // instant, not smooth
          });
          isInitialLoadRef.current = false;
        }
      }
    }, [searchParams, messages]);

    // Listen for click events, clear highlight when user clicks anywhere on the page
    useEffect(() => {
      const handleClick = (event: MouseEvent) => {
        const messageId = searchParams.get("messageId");
        // Only need to manually clear highlight when messageId parameter exists
        if (messageId) {
          // Check if click is from outside toast (i.e., user actively interacting with page)
          const target = event.target as HTMLElement;
          const isFromToast = target.closest("[data-sonner-toast]");
          // If not from toast click, clear highlight
          if (!isFromToast) {
            setHighlightedMessageId(null);
          }
        }
      };

      document.addEventListener("click", handleClick);
      return () => {
        document.removeEventListener("click", handleClick);
      };
    }, [searchParams]);

    // Format message time - optimized with useCallback
    const formatMessageTime = useCallback(
      (dateString: string | null | undefined) => {
        // Fault tolerance: return '--' if date string is invalid
        if (!dateString || typeof dateString !== "string") {
          return "--";
        }

        const date = new Date(dateString);

        // Check if date is valid
        if (isNaN(date.getTime())) {
          return "--";
        }

        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
          return format(date, "HH:mm", { locale: enUS });
        } else if (diffInHours < 168) {
          // 7 days
          return format(date, "MM/dd HH:mm", { locale: enUS });
        } else {
          return format(date, "yyyy/MM/dd HH:mm", { locale: enUS });
        }
      },
      [],
    );

    // Format message date - optimized with useCallback
    const formatMessageDate = useCallback(
      (dateString: string | null | undefined) => {
        // Fault tolerance: return default date if date string is invalid
        if (!dateString || typeof dateString !== "string") {
          return "Unknown date";
        }

        const date = new Date(dateString);

        // Check if date is valid
        if (isNaN(date.getTime())) {
          return "Unknown date";
        }

        const now = new Date();
        const diffInDays = Math.floor(
          (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (diffInDays === 0) {
          return "Today";
        } else if (diffInDays === 1) {
          return "Yesterday";
        } else if (diffInDays < 7) {
          return formatDistanceToNow(date, { addSuffix: true, locale: enUS });
        } else {
          return format(date, "yyyy-MM-dd", { locale: enUS });
        }
      },
      [],
    );

    // Group messages by date - optimized with useMemo to avoid recalculating on every render
    const messageGroups = useMemo(() => {
      const groups: { [key: string]: Message[] } = {};

      // Use Set to track already warned invalid messages to avoid duplicate logs
      const warnedMessages = new Set<string>();

      messages.forEach((message) => {
        // Fault tolerance: skip invalid messages
        if (!message || !message.createdAt) {
          if (!warnedMessages.has(message.id)) {
            console.warn("Invalid message or missing createdAt:", message);
            warnedMessages.add(message.id);
          }
          return;
        }

        // Check if createdAt is string type
        if (typeof message.createdAt !== "string") {
          if (!warnedMessages.has(message.id)) {
            console.warn(
              "Invalid createdAt type:",
              typeof message.createdAt,
              message.createdAt,
            );
            warnedMessages.add(message.id);
          }
          return;
        }

        const date = new Date(message.createdAt);

        // Check if date is valid
        if (isNaN(date.getTime())) {
          if (!warnedMessages.has(message.id)) {
            console.warn("Invalid date value:", message.createdAt);
            warnedMessages.add(message.id);
          }
          return;
        }

        const dateKey = format(date, "yyyy-MM-dd");

        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(message);
      });

      return groups;
    }, [messages]);

    if (isLoading) {
      return (
        <div
          className={`flex-1 min-h-0 overflow-y-auto message-scroll max-h-[calc(100vh-120px)] p-6 ${className}`}
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-text-secondary mt-4">Loading messages...</p>
            </div>
          </div>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div
          className={`flex-1 min-h-0 overflow-y-auto message-scroll max-h-[calc(100vh-120px)] p-6 ${className}`}
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  className="w-8 h-8 text-primary"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                There are no messages yet
              </h3>
              <p className="text-text-secondary">
                Start the conversation by sending the first message!
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative h-full">
        {/* Unread capsule button */}
        {showUnreadBadge && unreadCount > 0 && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={scrollToFirstUnread}
              className="bg-primary text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              {unreadCount} unread
            </button>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden message-scroll h-full p-6`}
          style={{ scrollbarGutter: "stable" }}
          id="messages-scroll-container"
        >
          <div className="max-w-4xl mx-auto w-full">
            {/* Top sentinel for infinite scroll */}
            <div ref={topSentinelRef} className="h-1" />
            {isLoadingMore && (
            <div className="text-center py-3">
              <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-text-secondary text-xs mt-1">Loading older messages...</p>
            </div>
          )}
          {Object.entries(messageGroups).map(([dateKey, dayMessages]) => (
            <div key={dateKey}>
              {/* Date divider */}
              <div className="flex items-center justify-center my-6">
                <div className="bg-background-component px-4 py-1 rounded-full text-xs text-text-tertiary">
                  {formatMessageDate(dayMessages[0].createdAt)}
                </div>
              </div>

              {/* Message list */}
              <div className="space-y-4">
                {dayMessages.map((message, index) => {
                  const isOwnMessage = message.userId === currentUserId;
                  const showAvatar =
                    index === 0 ||
                    dayMessages[index - 1].userId !== message.userId;
                  const isHighlighted = message.id === highlightedMessageId;
                  const isFirstUnread = message.id === unreadDividerMessageId;

                  return (
                    <div key={message.id}>
                      {isFirstUnread && (
                        <div ref={unreadDividerRef} className="flex items-center my-4 gap-3">
                          <div className="flex-1 h-px bg-gray-300" />
                          <span className="text-xs text-gray-400 font-medium whitespace-nowrap px-2">
                            New messages
                          </span>
                          <div className="flex-1 h-px bg-gray-300" />
                        </div>
                      )}
                      <MessageItem
                        message={message}
                        currentUserId={currentUserId}
                        isOwnMessage={isOwnMessage}
                        showAvatar={showAvatar}
                        isHighlighted={isHighlighted}
                        showReadIndicator={showReadIndicator}
                        editingMessageId={editingMessageId}
                        onStartEditing={startEditing}
                        onSaveEdit={handleEditMessage}
                        onCancelEdit={cancelEditing}
                        onDeleteMessage={handleDeleteMessage}
                        onThreadReply={onThreadReply || (() => {})}
                        onQuote={onQuote || (() => {})}
                        formatMessageTime={formatMessageTime}
                        messageRefs={messageRefs}
                        scrollContainerRef={scrollContainerRef}
                        members={members}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Auto-scroll anchor - ensures new messages scroll to bottom when they arrive */}
          <div ref={messagesEndRef} className="h-1" id="messages-end-ref" />
        </div>
        </div>
      </div>
    );
  },
);

MessageList.displayName = "MessageList";

export default MessageList;
