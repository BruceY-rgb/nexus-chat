// =====================================================
// Notification Listener Hook
// Listen for WebSocket new notification events and display Slack-style toast
// Integrate browser native notification function (only triggered when page is in background)
// =====================================================

import { useEffect, useCallback } from "react";
import { useSocket } from "./useSocket";
import { NewNotificationPayload } from "@/types/socket";
import { showSlackToast } from "@/components/ui/SlackToast";

interface UseNotificationsOptions {
  userId?: string;
}

// Browser notification permission type
type NotificationPermission = "default" | "granted" | "denied";

// Check browser notification support
const isNotificationSupported = (): boolean => {
  return typeof window !== "undefined" && "Notification" in window;
};

// Get notification permission
const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) {
    return "denied";
  }
  return Notification.permission;
};

// Request notification permission
const requestNotificationPermission =
  async (): Promise<NotificationPermission> => {
    if (!isNotificationSupported()) {
      return "denied";
    }

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return "denied";
    }
  };

// Display browser native notification
const showBrowserNotification = (
  notification: NewNotificationPayload,
): void => {
  // Detailed debug log
  console.log("🔔 [DEBUG] showBrowserNotification called", {
    notificationId: notification.id,
    notificationType: notification.type,
    timestamp: new Date().toISOString(),
  });

  // Environment check
  if (!isNotificationSupported()) {
    console.warn("❌ [DEBUG] Browser notifications not supported");
    return;
  }
  console.log("✅ [DEBUG] Browser notifications are supported");

  // Permission check
  const permission = getNotificationPermission();
  console.log("🔍 [DEBUG] Notification permission status:", permission);

  if (permission !== "granted") {
    console.log("❌ [DEBUG] Notification permission not granted:", permission);
    console.log("💡 [TIP] To enable notifications:");
    console.log("  1. Click the address bar notification icon");
    console.log(
      "  2. Or go to browser settings > Site Settings > Notifications",
    );
    return;
  }
  console.log("✅ [DEBUG] Notification permission granted");

  // Page visibility check - only show native notification when page is hidden
  if (typeof document !== "undefined") {
    const visibilityState = document.visibilityState;
    console.log("🔍 [DEBUG] Page visibility state:", visibilityState);

    if (visibilityState !== "hidden") {
      console.log(
        "⚠️ [DEBUG] Page is visible, skipping browser notification (this is correct behavior)",
      );
      console.log(
        "💡 [TIP] Switch to another tab or minimize the window to test notifications",
      );
      return;
    }
    console.log("✅ [DEBUG] Page is hidden, will show browser notification");
  }

  // Notification type filter - only show native notification for mention and dm
  if (notification.type !== "mention" && notification.type !== "dm") {
    console.log(
      "⚠️ [DEBUG] Skipping browser notification for type:",
      notification.type,
    );
    return;
  }
  console.log("✅ [DEBUG] Notification type is valid:", notification.type);

  // Prepare notification content
  const title = notification.title || "New Message";
  const messageContent = notification.content || "";
  const avatarUrl = notification.user?.avatarUrl || "/favicon.ico";
  const senderName = notification.user?.displayName || "Unknown User";

  // Format message content (limit length)
  const formattedContent =
    messageContent.length > 50
      ? `${messageContent.substring(0, 50)}...`
      : messageContent;

  // Build notification tag for deduplication
  let notificationTag = "";
  if (notification.type === "mention" && notification.relatedChannelId) {
    notificationTag = `channel-${notification.relatedChannelId}`;
  } else if (
    notification.type === "dm" &&
    notification.relatedDmConversationId
  ) {
    notificationTag = `dm-${notification.relatedDmConversationId}`;
  } else if (notification.type === "dm" && notification.user?.id) {
    notificationTag = `dm-user-${notification.user.id}`;
  }

  // Create notification options
  const notificationOptions: NotificationOptions = {
    body: `${senderName}: ${formattedContent}`,
    icon: avatarUrl,
    tag: notificationTag,
    badge: "/favicon.ico",
    requireInteraction: false,
    silent: false,
  };

  console.log("🔍 [DEBUG] Notification options:", notificationOptions);

  // Display notification
  try {
    console.log("🚀 [DEBUG] Creating notification...");
    const browserNotification = new Notification(title, notificationOptions);

    // Behavior when clicking notification: focus page and navigate to corresponding chat
    browserNotification.onclick = () => {
      console.log("🔔 [DEBUG] Notification clicked");
      // Focus on current window
      window.focus();

      // Navigate to corresponding chat page
      if (notification.type === "mention" && notification.relatedChannelId) {
        // Navigate to channel
        window.location.href = `/dashboard?channel=${notification.relatedChannelId}`;
      } else if (notification.type === "dm" && notification.user?.id) {
        // Navigate to DM
        window.location.href = `/dm/${notification.user.id}`;
      }

      // Close notification
      browserNotification.close();
    };

    console.log("✅ [SUCCESS] Browser notification displayed:", {
      title,
      tag: notificationTag,
      type: notification.type,
      sender: senderName,
      content: formattedContent,
    });

    // Add extra tips if all conditions are met but notification still doesn't show
    setTimeout(() => {
      console.log("💡 [TIP] If you still don't see the notification:");
      console.log("  1. Check your browser's notification center");
      console.log("  2. Ensure notifications are not blocked for this site");
      console.log(
        "  3. Try the test notification button in the diagnostics panel",
      );
    }, 1000);
  } catch (error) {
    console.error("❌ [ERROR] Error displaying browser notification:", error);
  }
};

export function useNotifications(options?: UseNotificationsOptions) {
  const { socket } = useSocket();
  const { userId } = options || {};

  // Request notification permission on initialization
  useEffect(() => {
    if (!userId) return;

    const initNotifications = async () => {
      const permission = getNotificationPermission();

      if (permission === "default") {
        console.log("🔔 Requesting notification permission...");
        const newPermission = await requestNotificationPermission();
        console.log("🔔 Notification permission result:", newPermission);
      } else {
        console.log("🔔 Notification permission status:", permission);
      }
    };

    initNotifications();
  }, [userId]);

  useEffect(() => {
    if (!socket || !userId) {
      return;
    }

    console.log("🔔 Setting up notification listener for user:", userId);

    // Listen for new notification events
    const handleNewNotification = (notification: NewNotificationPayload) => {
      console.log("🔔 Received new notification:", notification);

      // Display Slack-style custom toast (always display)
      showSlackToast(notification);

      // Display browser native notification (only when page is in background)
      showBrowserNotification(notification);
    };

    // Register listener
    socket.on("new-notification", handleNewNotification);

    // Cleanup function
    return () => {
      console.log("🔔 Removing notification listener for user:", userId);
      socket.off("new-notification", handleNewNotification);
    };
  }, [socket, userId]);

  // Methods exposed to component
  const requestPermission =
    useCallback(async (): Promise<NotificationPermission> => {
      return await requestNotificationPermission();
    }, []);

  const getPermission = useCallback((): NotificationPermission => {
    return getNotificationPermission();
  }, []);

  const isSupported = useCallback((): boolean => {
    return isNotificationSupported();
  }, []);

  return {
    requestPermission,
    getPermission,
    isSupported,
  };
}
