import { create } from 'zustand';

interface UnreadState {
  // Unread message mapping: key is channelId or dmConversationId, value is unread count
  unreadMap: Record<string, number>;
  // 静音的会话列表
  mutedList: Set<string>;
  // 总未读数
  totalUnreadCount: number;

  // Actions
  incrementUnread: (conversationId: string, count?: number) => void;
  decrementUnread: (conversationId: string, count?: number) => void;
  setUnread: (conversationId: string, count: number) => void;
  clearUnread: (conversationId: string) => void;
  clearAllUnread: () => void;
  muteConversation: (conversationId: string) => void;
  unmuteConversation: (conversationId: string) => void;
  setUnreadFromDB: (data: Record<string, number>) => void;
  getUnreadCount: (conversationId: string) => number;
}

export const useUnreadStore = create<UnreadState>((set, get) => ({
  unreadMap: {},
  mutedList: new Set(),
  totalUnreadCount: 0,

  incrementUnread: (conversationId: string, count = 1) => {
    const { unreadMap, mutedList } = get();

    // 如果已静音，不增加未读数
    if (mutedList.has(conversationId)) {
      return;
    }

    const newUnreadMap = {
      ...unreadMap,
      [conversationId]: (unreadMap[conversationId] || 0) + count
    };

    const totalUnreadCount = Object.values(newUnreadMap).reduce(
      (sum, count) => sum + count,
      0
    );

    set({ unreadMap: newUnreadMap, totalUnreadCount });
    updateBrowserTitle(totalUnreadCount);
  },

  decrementUnread: (conversationId: string, count = 1) => {
    const { unreadMap } = get();
    const currentCount = unreadMap[conversationId] || 0;
    const newCount = Math.max(0, currentCount - count);

    const newUnreadMap = {
      ...unreadMap,
      [conversationId]: newCount
    };

    // If count is 0, delete the entry
    if (newCount === 0) {
      delete newUnreadMap[conversationId];
    }

    const totalUnreadCount = Object.values(newUnreadMap).reduce(
      (sum, count) => sum + count,
      0
    );

    set({ unreadMap: newUnreadMap, totalUnreadCount });
    updateBrowserTitle(totalUnreadCount);
  },

  setUnread: (conversationId: string, count: number) => {
    const { unreadMap, mutedList } = get();

    // If muted, do not set unread count
    if (mutedList.has(conversationId)) {
      return;
    }

    const newUnreadMap = {
      ...unreadMap,
      [conversationId]: Math.max(0, count)
    };

    // If count is 0, delete the entry
    if (count === 0) {
      delete newUnreadMap[conversationId];
    }

    const totalUnreadCount = Object.values(newUnreadMap).reduce(
      (sum, count) => sum + count,
      0
    );

    set({ unreadMap: newUnreadMap, totalUnreadCount });
    updateBrowserTitle(totalUnreadCount);
  },

  clearUnread: (conversationId: string) => {
    const { unreadMap } = get();
    const newUnreadMap = { ...unreadMap };
    delete newUnreadMap[conversationId];

    const totalUnreadCount = Object.values(newUnreadMap).reduce(
      (sum, count) => sum + count,
      0
    );

    set({ unreadMap: newUnreadMap, totalUnreadCount });
    updateBrowserTitle(totalUnreadCount);
  },

  clearAllUnread: () => {
    set({ unreadMap: {}, totalUnreadCount: 0 });
    updateBrowserTitle(0);
  },

  muteConversation: (conversationId: string) => {
    const { mutedList } = get();
    const newMutedList = new Set(mutedList);
    newMutedList.add(conversationId);
    set({ mutedList: newMutedList });
  },

  unmuteConversation: (conversationId: string) => {
    const { mutedList } = get();
    const newMutedList = new Set(mutedList);
    newMutedList.delete(conversationId);
    set({ mutedList: newMutedList });
  },

  setUnreadFromDB: (data: Record<string, number>) => {
    // 过滤掉已静音的会话
    const { mutedList } = get();
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([id]) => !mutedList.has(id))
    );

    const totalUnreadCount = Object.values(filteredData).reduce(
      (sum, count) => sum + count,
      0
    );

    set({ unreadMap: filteredData, totalUnreadCount });
    updateBrowserTitle(totalUnreadCount);
  },

  getUnreadCount: (conversationId: string) => {
    const { unreadMap, mutedList } = get();
    if (mutedList.has(conversationId)) {
      return 0;
    }
    return unreadMap[conversationId] || 0;
  }
}));

// 更新浏览器标题
function updateBrowserTitle(totalUnreadCount: number) {
  const baseTitle = 'Slack';
  const newTitle =
    totalUnreadCount > 0 ? `(${totalUnreadCount}) ${baseTitle}` : baseTitle;

  if (typeof window !== 'undefined') {
    document.title = newTitle;
  }
}

// 监听 store 变化，自动更新标题
if (typeof window !== 'undefined') {
  useUnreadStore.subscribe((state) => {
    updateBrowserTitle(state.totalUnreadCount);
  });
}
