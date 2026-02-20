"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ReadProgress {
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
}

interface UseReadProgressProps {
  channelId?: string;
  dmConversationId?: string;
  messages: any[];
  messageRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  onScrollToMessage?: (messageId: string) => void;
}

export function useReadProgress({
  channelId,
  dmConversationId,
  messages,
  messageRefs,
  onScrollToMessage,
}: UseReadProgressProps) {
  const router = useRouter();
  const [readPosition, setReadPosition] = useState<ReadProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const hasScrolledToReadPosition = useRef(false);

  // Fetch read position
  const fetchReadPosition = useCallback(
    async (retryCount = 0) => {
      if (!channelId && !dmConversationId) {
        setIsLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (channelId) params.append("channelId", channelId);
        if (dmConversationId)
          params.append("dmConversationId", dmConversationId);

        const response = await fetch(
          `/api/conversations/read-position?${params.toString()}`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        if (response.ok) {
          const data = await response.json();
          setReadPosition({
            lastReadMessageId: data.lastReadMessageId,
            lastReadAt: data.lastReadAt ? new Date(data.lastReadAt) : null,
          });
        } else if (response.status === 403) {
          // Permission error: user may not be a channel member
          console.warn(
            "⚠️ Permission denied when fetching read position, may not be a channel member",
          );
          // Set default position (unread)
          setReadPosition({
            lastReadMessageId: null,
            lastReadAt: null,
          });
          // Delayed retry (max 3 times)
          if (retryCount < 3) {
            setTimeout(
              () => {
                fetchReadPosition(retryCount + 1);
              },
              1000 * (retryCount + 1),
            );
          }
        }
      } catch (error) {
        console.error("Failed to fetch read position:", error);
        // Network errors can also retry
        if (retryCount < 3) {
          setTimeout(
            () => {
              fetchReadPosition(retryCount + 1);
            },
            1000 * (retryCount + 1),
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [channelId, dmConversationId],
  );

  // Report read progress
  const reportReadProgress = useCallback(
    async (messageId: string) => {
      if (!channelId && !dmConversationId) return;

      // Clear previous debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set new debounce timer (execute after 2 seconds)
      debounceRef.current = setTimeout(async () => {
        try {
          await fetch("/api/messages/read", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              channelId,
              dmConversationId,
              lastReadMessageId: messageId,
            }),
          });
        } catch (error) {
          console.error("Failed to report read progress:", error);
        }
      }, 2000);
    },
    [channelId, dmConversationId],
  );

  // Auto-scroll to last read position
  const scrollToReadPosition = useCallback(() => {
    if (
      !readPosition?.lastReadMessageId ||
      !messages.length ||
      hasScrolledToReadPosition.current
    ) {
      return;
    }

    const messageElement = messageRefs.current[readPosition.lastReadMessageId];
    if (messageElement) {
      // Delay execution to ensure DOM is fully rendered
      setTimeout(() => {
        messageElement.scrollIntoView({ behavior: "instant", block: "start" });
        hasScrolledToReadPosition.current = true;
        if (onScrollToMessage) {
          onScrollToMessage(readPosition.lastReadMessageId!);
        }
      }, 100);
    }
  }, [readPosition, messages, messageRefs, onScrollToMessage]);

  // Listen for message loading, auto-position
  useEffect(() => {
    if (!isLoading && messages.length) {
      scrollToReadPosition();
    }
  }, [isLoading, messages, scrollToReadPosition]);

  // Fetch read position on initialization
  useEffect(() => {
    fetchReadPosition();
  }, [fetchReadPosition]);

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    readPosition,
    isLoading,
    reportReadProgress,
    scrollToReadPosition,
  };
}
