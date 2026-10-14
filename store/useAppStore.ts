import { create } from 'zustand';

type AppState = {
  onlineIds: Set<string>;
  setOnline: (ids: string[]) => void;
  // Messages received since the page loaded and not yet opened, by sender (NOTIF-001).
  unread: Record<string, number>;
  addUnread: (senderId: string) => void;
  clearUnread: (senderId: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  onlineIds: new Set(),
  setOnline: (ids) => set({ onlineIds: new Set(ids) }),
  unread: {},
  addUnread: (senderId) => set((s) => ({ unread: { ...s.unread, [senderId]: (s.unread[senderId] ?? 0) + 1 } })),
  clearUnread: (senderId) =>
    set((s) => {
      if (!s.unread[senderId]) return s;
      const { [senderId]: _cleared, ...unread } = s.unread;
      return { unread };
    }),
}));

export const totalUnread = (s: AppState) => Object.values(s.unread).reduce((sum, n) => sum + n, 0);
