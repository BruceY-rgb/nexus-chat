'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  source: 'WebSocket' | 'API' | 'Component' | 'System';
  message: string;
  data?: any;
}

interface MessageMonitorProps {
  isVisible?: boolean;
  maxEntries?: number;
  className?: string;
}

export default function MessageMonitor({
  isVisible = false,
  maxEntries = 50,
  className = ''
}: MessageMonitorProps) {
  const { socket, isConnected } = useSocket();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  const addLog = (level: LogEntry['level'], source: LogEntry['source'], message: string, data?: any) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      level,
      source,
      message,
      data
    };

    setLogs(prev => {
      const newLogs = [entry, ...prev];
      return newLogs.slice(0, maxEntries);
    });
  };

  // 监听 WebSocket 事件
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      addLog('success', 'WebSocket', `WebSocket connected: ${socket.id}`);
    };

    const handleDisconnect = (reason: string) => {
      addLog('warn', 'WebSocket', `WebSocket disconnected: ${reason}`);
    };

    const handleNewMessage = (message: any) => {
      addLog('info', 'WebSocket', 'New message received', {
        messageId: message.id,
        content: message.content?.substring(0, 50),
        fromUser: message.userId,
        dmConversationId: message.dmConversationId,
        channelId: message.channelId
      });
    };

    const handleError = (error: any) => {
      addLog('error', 'WebSocket', 'WebSocket error', error);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('new-message', handleNewMessage);
    socket.on('error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('new-message', handleNewMessage);
      socket.off('error', handleError);
    };
  }, [socket]);

  // 自动滚动到底部
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = 0; // 新日志在顶部，所以滚动到顶部
    }
  }, [logs]);

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'info':
        return 'text-blue-600 bg-blue-50';
      case 'warn':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getSourceColor = (source: LogEntry['source']) => {
    switch (source) {
      case 'WebSocket':
        return 'text-purple-600 bg-purple-50';
      case 'API':
        return 'text-indigo-600 bg-indigo-50';
      case 'Component':
        return 'text-green-600 bg-green-50';
      case 'System':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 w-96 h-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-800">实时消息监控</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-600">
            {isConnected ? '已连接' : '未连接'}
          </span>
        </div>
      </div>

      {/* Logs */}
      <div
        ref={logsRef}
        className="flex-1 overflow-y-auto p-2 space-y-1 h-64"
        style={{ fontSize: '11px' }}
      >
        {logs.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No logs yet.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-1 p-2 rounded border border-gray-100 hover:bg-gray-50"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSourceColor(log.source)}`}>
                    {log.source}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTime(log.timestamp)}
                </span>
              </div>

              {/* Message */}
              <div className="text-gray-800 font-medium">
                {log.message}
              </div>

              {/* Data */}
              {log.data && (
                <details className="mt-1">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    查看详情
                  </summary>
                  <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <span className="text-xs text-gray-500">
          {logs.length} 条日志
        </span>
        <button
          onClick={() => setLogs([])}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          清空
        </button>
      </div>
    </div>
  );
}
