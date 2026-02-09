'use client';

import { useState, useEffect } from 'react';
import { Message } from '@/types/message';

interface ThreadWithMeta extends Message {
  unreadCount: number;
  lastReadAt: string | null;
  replies?: Message[];
  _count?: {
    replies: number;
  };
}

interface UseUnreadThreadsReturn {
  threads: ThreadWithMeta[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useUnreadThreads(): UseUnreadThreadsReturn {
  const [threads, setThreads] = useState<ThreadWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUnreadThreads = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/threads/unread');

      if (!response.ok) {
        throw new Error(`Failed to fetch unread threads: ${response.statusText}`);
      }

      const data = await response.json();
      setThreads(data.threads || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    await fetchUnreadThreads();
  };

  useEffect(() => {
    fetchUnreadThreads();
  }, []);

  return {
    threads,
    isLoading,
    error,
    refetch
  };
}
