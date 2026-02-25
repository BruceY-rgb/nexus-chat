"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./useAuth";
import { ConnectionStatus } from "@/types/database";
import React from "react";

interface SocketContextValue {
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

const defaultValue: SocketContextValue = {
  socket: null,
  isConnected: false,
  connectionStatus: "disconnected",
  connect: () => {},
  disconnect: () => {},
  forceReconnect: () => {},
  joinChannel: () => {},
  leaveChannel: () => {},
  joinDM: () => {},
  leaveDM: () => {},
  sendTypingStart: () => {},
  sendTypingStop: () => {},
  markMessagesAsRead: () => {},
};

const SocketContext = createContext<SocketContextValue>(defaultValue);

// Fix #1: Don't append /socket.io to URL — Socket.IO handles path internally
function getServerUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // Socket.IO client expects the server origin, not a ws:// URL
  // It handles protocol upgrade internally
  return appUrl;
}

function getWsToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "ws_token") return value;
  }
  return null;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const { user } = useAuth();

  const socketRef = useRef<Socket | null>(null);
  const isConnecting = useRef(false);
  const fallbackTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (isConnecting.current || socketRef.current?.connected) return;

    const token = getWsToken();
    if (!token || !user) return;

    // If there's an existing disconnected socket, clean it up first
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    isConnecting.current = true;

    const serverUrl = getServerUrl();

    // Fix #2: Remove forceNew — allow connection reuse
    // Fix #4: Remove autoConnect:false — we call connect() explicitly
    // Fix #10: Remove hardcoded secure:true — let Socket.IO infer from URL
    const inst = io(serverUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
      timeout: 20000,
      path: "/socket.io",
    });

    inst.on("connect", () => {
      console.log("[WS] Connected, id:", inst.id);
      setIsConnected(true);
      setConnectionStatus("connected");
      isConnecting.current = false;
      // Clear fallback timer on successful connect
      if (fallbackTimer.current) {
        clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    });

    inst.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
      setIsConnected(false);
      setConnectionStatus("disconnected");
      isConnecting.current = false;
      // Fix: server-initiated disconnect needs manual reconnect
      if (reason === "io server disconnect") {
        inst.connect();
      }
    });

    inst.on("reconnect_attempt", (attempt) => {
      console.log("[WS] Reconnect attempt", attempt);
      setConnectionStatus("reconnecting");
    });

    inst.on("reconnect", () => {
      console.log("[WS] Reconnected");
      setIsConnected(true);
      setConnectionStatus("connected");
      isConnecting.current = false;
    });

    // Fix #6: Recovery after max reconnect attempts exhausted
    inst.on("reconnect_failed", () => {
      console.log("[WS] Reconnect failed, will retry in 30s");
      setConnectionStatus("error");
      setIsConnected(false);
      isConnecting.current = false;
      // Exponential fallback: try again after 30 seconds
      fallbackTimer.current = setTimeout(() => {
        console.log("[WS] Fallback reconnect triggered");
        if (!socketRef.current?.connected) {
          inst.connect();
        }
      }, 30000);
    });

    inst.on("connect_error", (error) => {
      console.error("[WS] Connect error:", error.message);
      isConnecting.current = false;
    });

    socketRef.current = inst;
    setSocket(inst);
  }, [user?.id]);

  const disconnect = useCallback(() => {
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus("disconnected");
      isConnecting.current = false;
    }
  }, []);

  const forceReconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 500);
  }, [disconnect, connect]);

  // Auto-connect when user is available
  useEffect(() => {
    const token = getWsToken();
    if (token && user && !socketRef.current?.connected && !isConnecting.current) {
      const t = setTimeout(() => connect(), 100);
      return () => clearTimeout(t);
    }
  }, [user?.id, connect]);

  // Fix #11: Always clean up on unmount
  useEffect(() => {
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Channel/DM operations
  const joinChannel = useCallback(
    (channelId: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("join-channel", channelId);
      }
    },
    [],
  );

  const leaveChannel = useCallback(
    (channelId: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("leave-channel", channelId);
      }
    },
    [],
  );

  const joinDM = useCallback(
    (conversationId: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("join-dm", conversationId);
      }
    },
    [],
  );

  const leaveDM = useCallback(
    (conversationId: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("leave-dm", conversationId);
      }
    },
    [],
  );

  const sendTypingStart = useCallback(
    (data: { channelId?: string; dmConversationId?: string }) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("typing-start", data);
      }
    },
    [],
  );

  const sendTypingStop = useCallback(
    (data: { channelId?: string; dmConversationId?: string }) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("typing-stop", data);
      }
    },
    [],
  );

  const markMessagesAsRead = useCallback(
    (data: {
      messageIds: string[];
      channelId?: string;
      dmConversationId?: string;
    }) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("message-read", data);
      }
    },
    [],
  );

  const value: SocketContextValue = {
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

  return React.createElement(SocketContext.Provider, { value }, children);
}

// Fix #3: All consumers share the same socket via Context
export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
