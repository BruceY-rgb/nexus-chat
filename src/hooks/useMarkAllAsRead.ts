import { useState, useCallback } from 'react';
import { useUnreadStore } from '@/store/unreadStore';

interface MarkAllAsReadResult {
  channelsMarkedRead: number;
  conversationsMarkedRead: number;
  totalMarked: number;
}

interface UseMarkAllAsReadReturn {
  markAllAsRead: () => Promise<MarkAllAsReadResult | null>;
  isLoading: boolean;
}

export function useMarkAllAsRead(): UseMarkAllAsReadReturn {
  const [isLoading, setIsLoading] = useState(false);
  const clearAllUnread = useUnreadStore(state => state.clearAllUnread);

  const markAllAsRead = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/messages/read-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }

      const data = await response.json();

      // 清空本地未读状态
      clearAllUnread();

      return data as MarkAllAsReadResult;
    } catch (error) {
      console.error('Error marking all as read:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [clearAllUnread]);

  return {
    markAllAsRead,
    isLoading,
  };
}
