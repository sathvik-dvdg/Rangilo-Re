import { create } from 'zustand';

type AppState = {
  onlineIds: Set<string>;
  setOnline: (ids: string[]) => void;
  // Per-room unlocks, so a reveal/extension shows up instantly after payment.
  revealed: Record<string, { real_name: string; email: string }>;
  setRevealed: (targetId: string, identity: { real_name: string; email: string }) => void;
};

export const useAppStore = create<AppState>((set) => ({
  onlineIds: new Set(),
  setOnline: (ids) => set({ onlineIds: new Set(ids) }),
  revealed: {},
  setRevealed: (targetId, identity) => set((s) => ({ revealed: { ...s.revealed, [targetId]: identity } })),
}));
