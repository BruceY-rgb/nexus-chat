import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./useAuth";
import { ConnectionStatus } from "@/types/database";

// Get WebSocket connection URL - fix mixed content error
const getWebSocketUrl = () => {
  // Prefer using environment variable NEXT_PUBLIC_APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // If it's https connection, WebSocket should also use wss
  // Ensure correct WebSocket URL is returned (ws:// or wss://)
  let wsUrl: string;

  if (appUrl.startsWith("https://")) {
    // HTTPS pages must use WSS
    wsUrl = appUrl.replace(/^https:/, "wss:");
  } else if (appUrl.startsWith("http://")) {
    // HTTP pages use WS
    wsUrl = appUrl.replace(/^http:/, "ws:");
  } else {
    // If no protocol, determine based on environment
    const isProduction = process.env.NODE_ENV === "production";
    const protocol = isProduction ? "wss" : "ws";
    wsUrl = `${protocol}://${appUrl}`;
  }

  // Add socket.io path
  if (!wsUrl.endsWith("/socket.io")) {
    wsUrl = `${wsUrl}/socket.io`;
  }

  console.log("🔌 [getWebSocketUrl] Generated WebSocket URL:", {
    originalUrl: appUrl,
    wsUrl,
    protocol: wsUrl.split("://")[0],
  });

  return wsUrl;
};

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  forceReconnect: () => void;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  joinDM: (conversationId: string) => void;
  leaveDM: (conversationId: string) => void;
  sendTypingStart: (data: {
    channelId?: string;
    dmConversationId?: string;
  }) => void;
  sendTypingStop: (data: {
    channelId?: string;
    dmConversationId?: string;
  }) => void;
  markMessagesAsRead: (data: {
    messageIds: string[];
    channelId?: string;
    dmConversationId?: string;
  }) => void;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const { user } = useAuth();

  // Use useRef to persist Socket instance and prevent duplicate creation
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = useRef<NodeJS.Timeout | null>(null);
  const isConnecting = useRef(false);
  const shouldCleanup = useRef(false);

  // Get token from cookie (ws_token for WebSocket use)
  const getToken = useCallback(() => {
    if (typeof document === "undefined") return null;
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "ws_token") {
        return value;
      }
    }
    return null;
  }, []);

  const connect = useCallback(() => {
    // Prevent duplicate connections - check using socketRef
    if (isConnecting.current || socketRef.current?.connected) {
      console.log(`🔌 [connect] Already connected or connecting, skipping`);
      return;
    }

    const token = getToken();
    console.log(`🔌 [connect] Attempting to connect with ws_token:`, {
      hasToken: !!token,
      hasUser: !!user,
      userId: user?.id,
      existingSocket: !!socketRef.current,
      tokenLength: token ? token.length : 0,
    });

    if (!token || !user) {
      console.log(`❌ [connect] Cannot connect: missing token or user`);
      return;
    }

    isConnecting.current = true;

    // Get WebSocket connection URL
    const wsUrl = getWebSocketUrl();
    console.log("🔌 [connect] Connecting to WebSocket server:", {
      wsUrl,
      environment: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });

    const socketInstance = io(wsUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
      // Add timeout configuration
      timeout: 20000,
      // Force websocket transport (optional)
      forceNew: true,
      // Force secure connection (automatically use WSS in HTTPS environment)
      secure: true,
      // If using self-signed certificate, allow not verifying certificate
      rejectUnauthorized: false,
      // Enable auto-connect
      autoConnect: false,
      // Enhanced connection parameters
      upgrade: true,
      rememberUpgrade: true,
      // Force HTTP/1.1 if needed
      // Note: It is recommended to configure correct SSL certificates in production
      // instead of using rejectUnauthorized: false
    });

    // Connection successful
    socketInstance.on("connect", () => {
      console.log("✅ WebSocket connected");
      setIsConnected(true);
      setConnectionStatus("connected");
      reconnectAttempts.current = 0;
      isConnecting.current = false;

      if (reconnectInterval.current) {
        clearInterval(reconnectInterval.current);
        reconnectInterval.current = null;
      }
    });

    // Connection disconnected
    socketInstance.on("disconnect", (reason) => {
      console.log("❌ WebSocket disconnected:", reason);
      setIsConnected(false);
      setConnectionStatus("disconnected");
      isConnecting.current = false;

      // If server disconnects actively, try to reconnect
      if (reason === "io server disconnect") {
        socketInstance.connect();
      }
    });

    // Reconnection attempt
    socketInstance.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      setConnectionStatus("reconnecting");
      reconnectAttempts.current = attemptNumber;
    });

    // Reconnection successful
    socketInstance.on("reconnect", (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setConnectionStatus("connected");
      isConnecting.current = false;
    });

    // Reconnection failed
    socketInstance.on("reconnect_failed", () => {
      console.log("❌ Failed to reconnect after maximum attempts");
      setConnectionStatus("error");
      setIsConnected(false);
      isConnecting.current = false;
    });

    // Error handling
    socketInstance.on("error", (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus("error");
      isConnecting.current = false;
    });

    // Update both state and ref
    socketRef.current = socketInstance;
    setSocket(socketInstance);
    console.log(`✅ [connect] Socket instance created and set to state:`, {
      socketId: socketInstance.id,
      connected: socketInstance.connected,
    });
  }, [user?.id, getToken]); // Fix dependencies: only depend on user?.id to avoid loops

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log("🔌 Manually disconnecting WebSocket");
      isConnecting.current = false;
      shouldCleanup.current = true; // Mark as needing cleanup
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus("disconnected");
    }
  }, []); // Fix dependencies: empty dependency array

  // Force reconnect
  const forceReconnect = useCallback(() => {
    console.log("🔌 Force reconnecting WebSocket");
    disconnect();
    setTimeout(() => {
      connect();
    }, 500);
  }, [disconnect, connect]);

  // Auto-connect - fix circular dependency and infinite loop issues
  useEffect(() => {
    const token = getToken();
    console.log(`🔌 [useSocket] Auto-connect check:`, {
      hasToken: !!token,
      hasUser: !!user,
      isConnecting: isConnecting.current,
      hasSocketRef: !!socketRef.current,
      socketId: socketRef.current?.id,
      isSocketConnected: socketRef.current?.connected,
      userId: user?.id,
    });

    // Only connect when there is token and user, and currently not connected and not connecting
    // Key fix: use socketRef.current?.connected state
    if (
      token &&
      user &&
      !socketRef.current?.connected &&
      !isConnecting.current
    ) {
      console.log(`🔌 [useSocket] Starting connection...`);
      // Use setTimeout to avoid directly calling connect during rendering
      const timeoutId = setTimeout(() => {
        connect();
      }, 100); // Increase delay to avoid immediate reconnect

      return () => clearTimeout(timeoutId);
    }

    return () => {
      if (reconnectInterval.current) {
        clearInterval(reconnectInterval.current);
        reconnectInterval.current = null;
      }
    };
  }, [user?.id, getToken, connect]); // Dependencies: user?.id, getToken, connect

  // Cleanup - improved cleanup logic to prevent memory leaks
  useEffect(() => {
    return () => {
      console.log("🔌 [useSocket] Cleaning up socket connection", {
        hasSocket: !!socketRef.current,
        shouldCleanup: shouldCleanup.current,
      });

      // Only cleanup when explicitly marked as needing cleanup
      if (shouldCleanup.current && socketRef.current) {
        console.log("🔌 [useSocket] Performing full cleanup");
        // Remove all event listeners
        socketRef.current.removeAllListeners();
        // Disconnect
        socketRef.current.disconnect();
        // Clean up reference
        socketRef.current = null;
        // Set to null
        setSocket(null);
        // Reset state
        setIsConnected(false);
        setConnectionStatus("disconnected");
        isConnecting.current = false;
        // Clean up reconnect timer
        if (reconnectInterval.current) {
          clearInterval(reconnectInterval.current);
          reconnectInterval.current = null;
        }
        // Reset cleanup flag
        shouldCleanup.current = false;
      } else {
        console.log(
          "🔌 [useSocket] Skipping cleanup (socketRef.current:",
          socketRef.current,
          ")",
        );
      }
    };
  }, []); // Empty dependency array, only execute once when component unmounts

  // Channel operations - use socketRef to avoid depending on socket state
  const joinChannel = useCallback(
    (channelId: string) => {
      if (socketRef.current && isConnected) {
        console.log(`📥 Joining channel: ${channelId}`);
        socketRef.current.emit("join-channel", channelId);
      }
    },
    [isConnected],
  ); // Only depend on isConnected

  const leaveChannel = useCallback(
    (channelId: string) => {
      if (socketRef.current && isConnected) {
        console.log(`📤 Leaving channel: ${channelId}`);
        socketRef.current.emit("leave-channel", channelId);
      }
    },
    [isConnected],
  ); // Only depend on isConnected

  // DM operations
  const joinDM = useCallback(
    (conversationId: string) => {
      if (socketRef.current && isConnected) {
        console.log(`📥 Joining DM: ${conversationId}`);
        socketRef.current.emit("join-dm", conversationId);
      }
    },
    [isConnected],
  ); // Only depend on isConnected

  const leaveDM = useCallback(
    (conversationId: string) => {
      if (socketRef.current && isConnected) {
        console.log(`📤 Leaving DM: ${conversationId}`);
        socketRef.current.emit("leave-dm", conversationId);
      }
    },
    [isConnected],
  ); // Only depend on isConnected

  // Typing indicator
  const sendTypingStart = useCallback(
    (data: { channelId?: string; dmConversationId?: string }) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("typing-start", data);
      }
    },
    [isConnected],
  ); // Only depend on isConnected

  const sendTypingStop = useCallback(
    (data: { channelId?: string; dmConversationId?: string }) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("typing-stop", data);
      }
    },
    [isConnected],
  ); // Only depend on isConnected

  // Message read
  const markMessagesAsRead = useCallback(
    (data: {
      messageIds: string[];
      channelId?: string;
      dmConversationId?: string;
    }) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("message-read", data);
      }
    },
    [isConnected],
  ); // Only depend on isConnected

  return {
    socket,
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    forceReconnect,
    joinChannel,
    leaveChannel,
    joinDM,
    leaveDM,
    sendTypingStart,
    sendTypingStop,
    markMessagesAsRead,
  };
}
