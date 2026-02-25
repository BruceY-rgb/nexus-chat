'use client';

import { useSocket } from '@/hooks/useSocket';
import { useEffect, useState } from 'react';

interface WebSocketStatusProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export default function WebSocketStatus({
  className = '',
  showDetails = false,
  compact = false
}: WebSocketStatusProps) {
  const { socket, isConnected, connectionStatus } = useSocket();
  const [socketId, setSocketId] = useState<string | undefined>(undefined);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastConnected, setLastConnected] = useState<Date | null>(null);

  useEffect(() => {
    if (socket) {
      setSocketId(socket.id);

      const updateConnectionInfo = () => {
        setSocketId(socket.id);
        setLastConnected(new Date());
      };

      socket.on('connect', updateConnectionInfo);
      socket.on('reconnect_attempt', () => {
        setReconnectAttempts(prev => prev + 1);
      });

      return () => {
        socket.off('connect', updateConnectionInfo);
      };
    }
  }, [socket]);

  // 紧凑模式 - 只显示连接状态指示器
  if (compact) {
    const getStatusColor = () => {
      switch (connectionStatus) {
        case 'connected':
          return 'bg-green-500';
        case 'reconnecting':
          return 'bg-yellow-500 animate-pulse';
        case 'error':
          return 'bg-red-500';
        default:
          return 'bg-gray-400';
      }
    };

    const getStatusText = () => {
      switch (connectionStatus) {
        case 'connected':
          return 'Connected';
        case 'reconnecting':
          return 'Reconnecting';
        case 'error':
          return 'Error';
        default:
          return 'Disconnected';
      }
    };

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-xs text-gray-600">{getStatusText()}</span>
      </div>
    );
  }

  // 详细模式
  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          text: 'Connected',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'reconnecting':
        return {
          text: 'Reconnecting',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'error':
        return {
          text: 'Connection Error',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          text: 'Disconnected',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div
      className={`
        ${statusInfo.bgColor} ${statusInfo.borderColor} border rounded-lg p-4
        ${className}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-green-500'
              : connectionStatus === 'reconnecting'
              ? 'bg-yellow-500 animate-pulse'
              : connectionStatus === 'error'
              ? 'bg-red-500'
              : 'bg-gray-400'
          }`}
        />
        <h3 className={`font-semibold ${statusInfo.color}`}>
          WebSocket Status: {statusInfo.text}
        </h3>
      </div>

      {showDetails && (
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Socket ID:</span>
              <span className="ml-2 font-mono text-xs">
                {socketId || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Reconnect Attempts:</span>
              <span className="ml-2">{reconnectAttempts}</span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <span className="ml-2">{connectionStatus}</span>
            </div>
            <div>
              <span className="text-gray-500">Last Connected:</span>
              <span className="ml-2">
                {lastConnected ? lastConnected.toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>

          {isConnected && socket && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  <span className="font-semibold">Transport:</span>{' '}
                  {socket.io.engine.transport.name}
                </div>
                <div>
                  <span className="font-semibold">Socket ID:</span>{' '}
                  {socket.id}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
