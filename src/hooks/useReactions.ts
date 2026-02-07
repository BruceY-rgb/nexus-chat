'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageReaction } from '@/types/message';
import { toast } from 'sonner';
import { useSocket } from './useSocket';

interface GroupedReaction {
  emoji: string;
  count: number;
  users: Array<{
    id: string;
    displayName: string;
  }>;
}

interface UseReactionsReturn {
  reactions: GroupedReaction[];
  userReactions: Set<string>;
  loading: boolean;
  error: string | null;
  toggleReaction: (emoji: string) => Promise<void>;
  refetch: () => Promise<void>;
  pendingReactions: PendingReaction[];
}

interface PendingReaction {
  emoji: string;
  action: 'add' | 'remove';
  tempId: string;
  timestamp: number;
}

/**
 * Hook for managing message reactions
 */
export function useReactions(
  messageId: string,
  currentUserId: string
): UseReactionsReturn {
  const [reactions, setReactions] = useState<GroupedReaction[]>([]);
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingReactions, setPendingReactions] = useState<PendingReaction[]>([]);

  // 状态快照 ref，用于错误回滚
  const snapshotRef = useRef<{
    reactions: GroupedReaction[];
    userReactions: Set<string>;
  } | null>(null);

  // 获取 Socket 实例
  const { socket, isConnected } = useSocket();

  // 获取 reactions
  const fetchReactions = useCallback(async () => {
    if (!messageId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reactions');
      }

      const data: GroupedReaction[] = await response.json();
      setReactions(data);

      // 提取当前用户的 reactions
      const userReactionSet = new Set<string>();
      data.forEach(group => {
        if (group.users.some(user => user.id === currentUserId)) {
          userReactionSet.add(group.emoji);
        }
      });
      setUserReactions(userReactionSet);
    } catch (err) {
      console.error('Error fetching reactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch reactions');
    } finally {
      setLoading(false);
    }
  }, [messageId, currentUserId]);

  // 切换 reaction - 实现乐观更新
  const toggleReaction = useCallback(async (emoji: string) => {
    // 检查是否有正在进行的更新
    if (pendingReactions.length > 0) {
      console.warn('已有待处理的反应更新，跳过此次操作');
      return;
    }

    const tempId = `optimistic-${Date.now()}-${Math.random()}`;
    const userHasReacted = userReactions.has(emoji);
    const action = userHasReacted ? 'remove' : 'add';

    // 1. 保存状态快照
    const snapshot = {
      reactions: [...reactions],
      userReactions: new Set(userReactions)
    };
    snapshotRef.current = snapshot;

    // 2. 立即更新 UI（乐观更新）
    setReactions(prev => {
      const newReactions = [...prev];
      const existingIndex = newReactions.findIndex(r => r.emoji === emoji);

      if (action === 'add') {
        if (existingIndex >= 0) {
          // 增加计数
          newReactions[existingIndex] = {
            ...newReactions[existingIndex],
            count: newReactions[existingIndex].count + 1,
            users: [...newReactions[existingIndex].users, {
              id: currentUserId,
              displayName: 'You'
            }]
          };
        } else {
          // 创建新的 reaction
          newReactions.push({
            emoji,
            count: 1,
            users: [{
              id: currentUserId,
              displayName: 'You'
            }]
          });
        }
      } else {
        // remove action
        if (existingIndex >= 0) {
          const reaction = newReactions[existingIndex];
          const newUsers = reaction.users.filter(u => u.id !== currentUserId);

          if (newUsers.length === 0) {
            // 移除整个 reaction
            newReactions.splice(existingIndex, 1);
          } else {
            // 减少计数
            newReactions[existingIndex] = {
              ...reaction,
              count: reaction.count - 1,
              users: newUsers
            };
          }
        }
      }

      return newReactions;
    });

    // 更新用户反应集合
    setUserReactions(prev => {
      const newSet = new Set(prev);
      if (action === 'add') {
        newSet.add(emoji);
      } else {
        newSet.delete(emoji);
      }
      return newSet;
    });

    // 添加到待处理队列
    const pending: PendingReaction = { emoji, action, tempId, timestamp: Date.now() };
    setPendingReactions(prev => [...prev, pending]);

    // 3. 发送 API 请求
    try {
      setError(null);

      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emoji,
          userId: currentUserId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle reaction');
      }

      const result = await response.json();

      // 4. 确认乐观更新 - 用服务器数据覆盖
      setReactions(result.reactions);

      // 重新计算用户反应集合
      const userReactionSet = new Set<string>();
      result.reactions.forEach((group: GroupedReaction) => {
        if (group.users.some(user => user.id === currentUserId)) {
          userReactionSet.add(group.emoji);
        }
      });
      setUserReactions(userReactionSet);

      // 清理快照和待处理队列
      setPendingReactions(prev => prev.filter(p => p.tempId !== tempId));
      snapshotRef.current = null;

    } catch (err) {
      // 5. 错误回滚 - 恢复之前的状态
      console.error('Error toggling reaction:', err);
      setReactions(snapshot.reactions);
      setUserReactions(snapshot.userReactions);
      setPendingReactions(prev => prev.filter(p => p.tempId !== tempId));
      snapshotRef.current = null;

      // 显示错误提示
      const errorMessage = err instanceof Error ? err.message : 'Failed to update reaction';
      setError(errorMessage);

      toast.error('Failed to update reaction', {
        description: errorMessage,
        duration: 3000,
      });
    }
  }, [messageId, currentUserId, reactions, userReactions, pendingReactions]);

  // 刷新数据
  const refetch = useCallback(async () => {
    await fetchReactions();
  }, [fetchReactions]);

  // 监听 WebSocket reaction 更新事件 - 只处理其他用户触发的更新
  useEffect(() => {
    if (!socket) return;

    const handleReactionUpdate = (data: {
      messageId: string;
      action: 'added' | 'removed';
      reactions: GroupedReaction[];
      userId?: string; // 可选：触发更新的用户ID
    }) => {
      // 验证事件是否属于当前消息
      if (data.messageId !== messageId) return;

      // 关键修复：如果有 userId 且是自己触发的，则跳过
      // 因为乐观更新已经处理了自己的操作
      if (data.userId === currentUserId) {
        console.log('📡 [useReactions] Skipping self-triggered update:', data);
        return;
      }

      // 检查是否有待处理的相同emoji操作
      const hasPendingSameEmoji = pendingReactions.some(p =>
        p.emoji === data.reactions.find(r => r.emoji === p.emoji)?.emoji
      );

      // 如果有待处理的相同emoji操作，也跳过（避免冲突）
      if (hasPendingSameEmoji) {
        console.log('📡 [useReactions] Skipping update with pending same emoji:', data);
        return;
      }

      console.log('📡 [useReactions] Applying remote reaction update:', data);

      // 更新 reactions 状态 - 只更新远程用户的操作
      setReactions(data.reactions);

      // 重新计算用户反应集合
      const userReactionSet = new Set<string>();
      data.reactions.forEach(group => {
        if (group.users.some(user => user.id === currentUserId)) {
          userReactionSet.add(group.emoji);
        }
      });
      setUserReactions(userReactionSet);
    };

    // 监听 reaction-updated 事件
    socket.on('reaction-updated', handleReactionUpdate);

    // 清理函数
    return () => {
      socket.off('reaction-updated', handleReactionUpdate);
    };
  }, [socket, messageId, currentUserId, pendingReactions]);

  // 初始加载
  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  return {
    reactions,
    userReactions,
    loading,
    error,
    toggleReaction,
    refetch,
    pendingReactions,
  };
}
