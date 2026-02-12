import { useState, useCallback } from 'react';

export type NotificationLevel = 'all' | 'mentions' | 'nothing';

interface UseNotificationPreferencesReturn {
  notificationLevels: Record<string, NotificationLevel>;
  setNotificationLevel: (conversationId: string, level: NotificationLevel, type: 'channel' | 'dm') => Promise<void>;
  getNotificationLevel: (conversationId: string) => NotificationLevel;
  isLoading: boolean;
}

export function useNotificationPreferences(): UseNotificationPreferencesReturn {
  const [notificationLevels, setNotificationLevels] = useState<Record<string, NotificationLevel>>({});
  const [isLoading, setIsLoading] = useState(false);

  const setNotificationLevel = useCallback(async (
    conversationId: string,
    level: NotificationLevel,
    type: 'channel' | 'dm'
  ) => {
    setIsLoading(true);
    try {
      const endpoint = type === 'channel'
        ? `/api/channels/${conversationId}/notification-preferences`
        : `/api/dm-conversations/${conversationId}/notification-preferences`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationLevel: level }),
      });

      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }

      setNotificationLevels(prev => ({
        ...prev,
        [conversationId]: level,
      }));
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getNotificationLevel = useCallback((conversationId: string): NotificationLevel => {
    return notificationLevels[conversationId] || 'all';
  }, [notificationLevels]);

  return {
    notificationLevels,
    setNotificationLevel,
    getNotificationLevel,
    isLoading,
  };
}
