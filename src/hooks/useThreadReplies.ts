'use client';

import { useState, useEffect } from 'react';
import { Message } from '@/types/message';

interface UseThreadRepliesReturn {
  replies: Message[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useThreadReplies(
  messageId: string | null
): UseThreadRepliesReturn {
  const [replies, setReplies] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const fetchReplies = async (reset = false) => {
    if (!messageId) return;

    setIsLoading(true);
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;
      const response = await fetch(
        `/api/messages/${messageId}/thread-replies?limit=${LIMIT}&offset=${currentOffset}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch replies: ${response.statusText}`);
      }

      const data = await response.json();
      const newReplies = data.replies || [];

      if (reset) {
        setReplies(newReplies);
      } else {
        setReplies(prev => [...prev, ...newReplies]);
      }

      setHasMore(data.hasMore);
      setOffset(currentOffset + LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    await fetchReplies(false);
  };

  const refetch = async () => {
    setOffset(0);
    await fetchReplies(true);
  };

  // 当messageId改变时，重新获取回复
  useEffect(() => {
    if (messageId) {
      setOffset(0);
      fetchReplies(true);
    } else {
      setReplies([]);
      setError(null);
      setHasMore(true);
      setOffset(0);
    }
  }, [messageId]);

  return {
    replies,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch
  };
}
