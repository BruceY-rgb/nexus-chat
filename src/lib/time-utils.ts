/**
 * Time formatting utilities
 * Centralized time formatting functions for consistent display across the app
 */

import { format } from 'date-fns';

/**
 * Format time based on how old it is (like Slack)
 * - Today: HH:mm
 * - This week: EEE HH:mm (e.g., "Mon 14:30")
 * - Older: yyyy/MM/dd HH:mm
 */
export function formatMessageTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return format(date, 'HH:mm');
  } else if (diffInHours < 24 * 7) {
    return format(date, 'EEE HH:mm');
  } else {
    return format(date, 'yyyy/MM/dd HH:mm');
  }
}

/**
 * Format time as relative (like "just now", "1h ago", "3d ago")
 * Good for thread lists and activity feeds
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return 'just now';
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`;
  } else if (diffInHours < 24 * 7) {
    return `${Math.floor(diffInHours / 24)}d ago`;
  } else {
    return format(date, 'MM/dd');
  }
}

/**
 * Format time in 12-hour format (like "2:30 PM")
 * Good for quotes and message headers
 */
export function formatTime12Hour(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '';
  }
}

/**
 * Format date for display (like "Jan 15, 2024")
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return format(date, 'MMM d, yyyy');
}

/**
 * Format full datetime (like "Jan 15, 2024 at 2:30 PM")
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

/**
 * Format date for file names (like "2024-01-15")
 */
export function formatDateForFilename(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return format(date, 'yyyy-MM-dd');
}
