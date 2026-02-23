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

    // Reset initial load flag when channel/conversation changes
    if (prevChannelRef.current !== channelId || prevDmRef.current !== dmConversationId) {
      isInitialLoadRef.current = true;
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

    // Use read progress hook - remove onScrollToMessage callback to avoid conflict with component highlight logic
    const { reportReadProgress } = useReadProgress({
      channelId,
      dmConversationId,
      messages,
      messageRefs,
    });

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

    const scrollToBottom = useCallback(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        setHighlightedMessageId(messageId);
        setTimeout(() => {
          scrollToMessage(messageId);
        }, 100);
        // Auto clear highlight after 2 seconds
        setTimeout(() => {
          setHighlightedMessageId(null);
        }, 2000);
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

        // Notify parent component of scroll position change
        if (onScrollPositionChange) {
          onScrollPositionChange(isAtBottom);
        }
      };

      // Scroll event handler
      const handleScroll = () => {
        // Use debounce to avoid frequent triggers
        clearTimeout(timeoutId);
        timeoutId = setTimeout(checkScrollPosition, 50);
      };

      // Initial check
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
        // Delayed execution to ensure message is rendered
        setTimeout(() => {
          scrollToMessage(messageId);
        }, 100);
        // Auto clear highlight after 2 seconds
        setTimeout(() => {
          setHighlightedMessageId(null);
        }, 2000);
      } else {
        // When no specific message, scroll to bottom only on initial load
        setHighlightedMessageId(null);
        if (isInitialLoadRef.current) {
          scrollToBottom();
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

                  return (
                    <MessageItem
                      key={message.id}
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
                  );
                })}
              </div>
            </div>
          ))}
          {/* Auto-scroll anchor - ensures new messages scroll to bottom when they arrive */}
          <div ref={messagesEndRef} className="h-1" id="messages-end-ref" />
        </div>
      </div>
    );
  },
);

MessageList.displayName = "MessageList";

export default MessageList;
