'use client';

// =====================================================
// Notification Provider component
// Automatically listen for WebSocket notification events and display toast
// =====================================================

import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';

export default function NotificationProvider() {
  const { user } = useAuth();

  // Set up notification listener with current user ID
  useNotifications({ userId: user?.id });

  // This component does not render any content
  return null;
}
