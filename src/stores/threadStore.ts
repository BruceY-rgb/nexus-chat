'use client';

import { create } from 'zustand';
import { Message } from '@/types/message';

interface ThreadSummary {
  id: string;
  content: string;
  userId: string;
  user?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  threadReplies?: Message[];
  _count?: {
    threadReplies: number;
  };
  unreadCount: number;
  lastReadAt: string | null;
  lastReplyAt?: string | null;
}

interface ThreadStore {
  // State
  activeThreadId: string | null;
  activeThreadMessage: Message | null;
  threadPanelOpen: boolean;
  unreadThreads: ThreadSummary[];
  unreadCount: number;
  isLoading: boolean;

  // Actions
  setActiveThread: (id: string | null, message?: Message | null) => void;
  closeThread: () => void;
  toggleThreadPanel: () => void;
  setUnreadThreads: (threads: ThreadSummary[]) => void;
  addUnreadThread: (thread: ThreadSummary) => void;
  removeUnreadThread: (threadId: string) => void;
  updateThreadReplyCount: (threadId: string, count: number) => void;
  setUnreadCount: (count: number) => void;
  markThreadAsRead: (threadId: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useThreadStore = create<ThreadStore>((set, get) => ({
  // Initial state
  activeThreadId: null,
  activeThreadMessage: null,
  threadPanelOpen: false,
  unreadThreads: [],
  unreadCount: 0,
  isLoading: false,

  // Actions
  setActiveThread: (id, message) => {
    set({
      activeThreadId: id,
      activeThreadMessage: message || null,
      threadPanelOpen: !!id,
    });
  },

  closeThread: () => {
    set({
      activeThreadId: null,
      activeThreadMessage: null,
      threadPanelOpen: false,
    });
  },

  toggleThreadPanel: () => {
    set((state) => ({
      threadPanelOpen: !state.threadPanelOpen,
    }));
  },

  setUnreadThreads: (threads) => {
    set({
      unreadThreads: threads,
      unreadCount: threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
    });
  },

  addUnreadThread: (thread) => {
    set((state) => {
      const exists = state.unreadThreads.find((t) => t.id === thread.id);
      if (exists) {
        return state;
      }
      return {
        unreadThreads: [thread, ...state.unreadThreads],
        unreadCount: state.unreadCount + thread.unreadCount,
      };
    });
  },

  removeUnreadThread: (threadId) => {
    set((state) => {
      const thread = state.unreadThreads.find((t) => t.id === threadId);
      if (!thread) return state;

      return {
        unreadThreads: state.unreadThreads.filter((t) => t.id !== threadId),
        unreadCount: Math.max(0, state.unreadCount - thread.unreadCount),
      };
    });
  },

  updateThreadReplyCount: (threadId, count) => {
    set((state) => ({
      unreadThreads: state.unreadThreads.map((thread) =>
        thread.id === threadId
          ? { ...thread, _count: { threadReplies: count } }
          : thread
      ),
    }));
  },

  setUnreadCount: (count) => {
    set({ unreadCount: count });
  },

  markThreadAsRead: (threadId) => {
    set((state) => ({
      unreadThreads: state.unreadThreads
        .map((thread) =>
          thread.id === threadId ? { ...thread, unreadCount: 0 } : thread
        )
        .filter((thread) => thread.unreadCount > 0),
      unreadCount: Math.max(
        0,
        state.unreadThreads.reduce((sum, thread) => {
          return thread.id === threadId ? sum : sum + thread.unreadCount;
        }, 0)
      ),
    }));
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },
}));
