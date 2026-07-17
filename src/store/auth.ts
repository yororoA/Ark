import { create } from 'zustand';

export interface AuthDetail {
  username?: string;
  uid: string;
  lastLoginAt?: string;
  isGuest?: boolean;
  isAdmin?: boolean;
  continent_code?: string;
  country_code?: string;
}

type AuthDetails = AuthDetail[];

interface AuthState {
  details: AuthDetails;
  initialized: boolean;
  addDetail: (detail: AuthDetail) => void;
  removeDetail: (uid: string) => void;
  clearDetails: () => void;
  getDetail: (uid: string) => AuthDetail | undefined;
  ensureInitialized: () => void;
  removeGuest: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  details: [],
  initialized: false,

  addDetail: (detail) => {
    get().ensureInitialized();
    set((state) => {
      const idx = state.details.findIndex((d) => d.uid === detail.uid);
      if (idx !== -1) {
        const updated = [...state.details];
        updated[idx] = { ...updated[idx], ...detail };
        return { details: updated };
      }
      return { details: [...state.details, detail] };
    });
  },

  removeDetail: (uid) => {
    get().ensureInitialized();
    set((state) => ({ details: state.details.filter((d) => d.uid !== uid) }));
  },

  clearDetails: () => {
    set({ details: [] });
  },

  getDetail: (uid) => {
    get().ensureInitialized();
    return get().details.find((d) => d.uid === uid);
  },

  ensureInitialized: () => {
    if (get().initialized) {
      return;
    }
    const details = localStorage.getItem('authDetails');
    set({ initialized: true });
    if (details) {
      try {
        set({ details: JSON.parse(details) });
      } catch (error) {
        console.error('解析认证详情失败:', error);
        set({ details: [] });
      }
    } else {
      localStorage.setItem('authDetails', JSON.stringify([]));
      set({ details: [] });
    }
  },

  removeGuest: () => {
    get().ensureInitialized();
    set((state) => ({ details: state.details.filter((d) => !d.isGuest) }));
  },
}));

// 订阅 details 变更，自动持久化到 localStorage
useAuthStore.subscribe((state, prevState) => {
  if (state.details !== prevState.details) {
    localStorage.setItem('authDetails', JSON.stringify(state.details));
  }
});
