"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageReaction } from "@/types/message";
import { toast } from "sonner";
import { useSocket } from "./useSocket";

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
  action: "add" | "remove";
  tempId: string;
  timestamp: number;
}

/**
 * Hook for managing message reactions
 */
export function useReactions(
  messageId: string,
  currentUserId: string,
): UseReactionsReturn {
  const [reactions, setReactions] = useState<GroupedReaction[]>([]);
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingReactions, setPendingReactions] = useState<PendingReaction[]>(
    [],
  );

  // State snapshot ref for error rollback
  const snapshotRef = useRef<{
    reactions: GroupedReaction[];
    userReactions: Set<string>;
  } | null>(null);

  // Get Socket instance
  const { socket, isConnected } = useSocket();

  // Fetch reactions
  const fetchReactions = useCallback(async () => {
    if (!messageId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch reactions");
      }

      const data: GroupedReaction[] = await response.json();
      setReactions(data);

      // Extract current user's reactions
      const userReactionSet = new Set<string>();
      data.forEach((group) => {
        if (group.users.some((user) => user.id === currentUserId)) {
          userReactionSet.add(group.emoji);
        }
      });
      setUserReactions(userReactionSet);
    } catch (err) {
      console.error("Error fetching reactions:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch reactions",
      );
    } finally {
      setLoading(false);
    }
  }, [messageId, currentUserId]);

  // Toggle reaction - implement optimistic update
  const toggleReaction = useCallback(
    async (emoji: string) => {
      // Check if there is an ongoing update
      if (pendingReactions.length > 0) {
        console.warn(
          "There is already a pending reaction update, skip this action",
        );
        return;
      }

      const tempId = `optimistic-${Date.now()}-${Math.random()}`;
      const userHasReacted = userReactions.has(emoji);
      const action = userHasReacted ? "remove" : "add";

      // 1. Save state snapshot
      const snapshot = {
        reactions: [...reactions],
        userReactions: new Set(userReactions),
      };
      snapshotRef.current = snapshot;

      // 2. Immediately update UI (optimistic update)
      setReactions((prev) => {
        const newReactions = [...prev];
        const existingIndex = newReactions.findIndex((r) => r.emoji === emoji);

        if (action === "add") {
          if (existingIndex >= 0) {
            // Increase count
            newReactions[existingIndex] = {
              ...newReactions[existingIndex],
              count: newReactions[existingIndex].count + 1,
              users: [
                ...newReactions[existingIndex].users,
                {
                  id: currentUserId,
                  displayName: "You",
                },
              ],
            };
          } else {
            // Create new reaction
            newReactions.push({
              emoji,
              count: 1,
              users: [
                {
                  id: currentUserId,
                  displayName: "You",
                },
              ],
            });
          }
        } else {
          // remove action
          if (existingIndex >= 0) {
            const reaction = newReactions[existingIndex];
            const newUsers = reaction.users.filter(
              (u) => u.id !== currentUserId,
            );

            if (newUsers.length === 0) {
              // Remove entire reaction
              newReactions.splice(existingIndex, 1);
            } else {
              // Decrease count
              newReactions[existingIndex] = {
                ...reaction,
                count: reaction.count - 1,
                users: newUsers,
              };
            }
          }
        }

        return newReactions;
      });

      // Update user reaction set
      setUserReactions((prev) => {
        const newSet = new Set(prev);
        if (action === "add") {
          newSet.add(emoji);
        } else {
          newSet.delete(emoji);
        }
        return newSet;
      });

      // Add to pending queue
      const pending: PendingReaction = {
        emoji,
        action,
        tempId,
        timestamp: Date.now(),
      };
      setPendingReactions((prev) => [...prev, pending]);

      // 3. Send API request
      try {
        setError(null);

        const response = await fetch(`/api/messages/${messageId}/reactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            emoji,
            userId: currentUserId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to toggle reaction");
        }

        const result = await response.json();

        // 4. Confirm optimistic update - overwrite with server data
        setReactions(result.reactions);

        // Recalculate user reaction set
        const userReactionSet = new Set<string>();
        result.reactions.forEach((group: GroupedReaction) => {
          if (group.users.some((user) => user.id === currentUserId)) {
            userReactionSet.add(group.emoji);
          }
        });
        setUserReactions(userReactionSet);

        // Clean up snapshot and pending queue
        setPendingReactions((prev) => prev.filter((p) => p.tempId !== tempId));
        snapshotRef.current = null;
      } catch (err) {
        // 5. Error rollback - restore previous state
        console.error("Error toggling reaction:", err);
        setReactions(snapshot.reactions);
        setUserReactions(snapshot.userReactions);
        setPendingReactions((prev) => prev.filter((p) => p.tempId !== tempId));
        snapshotRef.current = null;

        // Show error message
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update reaction";
        setError(errorMessage);

        toast.error("Failed to update reaction", {
          description: errorMessage,
          duration: 3000,
        });
      }
    },
    [messageId, currentUserId, reactions, userReactions, pendingReactions],
  );

  // Refresh data
  const refetch = useCallback(async () => {
    await fetchReactions();
  }, [fetchReactions]);

  // Listen for WebSocket reaction update events - only handle updates triggered by other users
  useEffect(() => {
    if (!socket) return;

    const handleReactionUpdate = (data: {
      messageId: string;
      action: "added" | "removed";
      reactions: GroupedReaction[];
      userId?: string; // Optional: user ID that triggered the update
    }) => {
      // Verify event belongs to current message
      if (data.messageId !== messageId) return;

      // Key fix: if userId exists and it's self-triggered, skip
      // because optimistic update already handled own operation
      if (data.userId === currentUserId) {
        console.log("📡 [useReactions] Skipping self-triggered update:", data);
        return;
      }

      // Check if there is pending same emoji operation
      const hasPendingSameEmoji = pendingReactions.some(
        (p) =>
          p.emoji === data.reactions.find((r) => r.emoji === p.emoji)?.emoji,
      );

      // If there is pending same emoji operation, also skip (to avoid conflicts)
      if (hasPendingSameEmoji) {
        console.log(
          "📡 [useReactions] Skipping update with pending same emoji:",
          data,
        );
        return;
      }

      console.log("📡 [useReactions] Applying remote reaction update:", data);

      // Update reactions state - only update remote user's operations
      setReactions(data.reactions);

      // Recalculate user reaction set
      const userReactionSet = new Set<string>();
      data.reactions.forEach((group) => {
        if (group.users.some((user) => user.id === currentUserId)) {
          userReactionSet.add(group.emoji);
        }
      });
      setUserReactions(userReactionSet);
    };

    // Listen for reaction-updated events
    socket.on("reaction-updated", handleReactionUpdate);

    // Cleanup function
    return () => {
      socket.off("reaction-updated", handleReactionUpdate);
    };
  }, [socket, messageId, currentUserId, pendingReactions]);

  // Initial load
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
