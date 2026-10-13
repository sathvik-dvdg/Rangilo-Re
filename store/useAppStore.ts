import { create } from 'zustand';

type AppState = {
  onlineIds: Set<string>;
  setOnline: (ids: string[]) => void;
};

export const useAppStore = create<AppState>((set) => ({
  onlineIds: new Set(),
  setOnline: (ids) => set({ onlineIds: new Set(ids) }),
}));
