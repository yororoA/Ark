import { create } from 'zustand';
import type { Session } from '@/lib/blog';

const STORAGE_KEY = 'authDetails:v2';
const LEGACY_STORAGE_KEY = 'authDetails';

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
  reconcileDetails: (sessions: Session[], activeUid?: string | null) => void;
  removeGuest: () => void;
}

function readStoredDetails(): AuthDetails {
  if (typeof window === 'undefined') return [];
  try {
    const serialized = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!serialized) return [];
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((detail): detail is AuthDetail => (
      !!detail && typeof detail === 'object' && typeof detail.uid === 'string' && detail.uid.length > 0
    ));
  } catch {
    return [];
  }
}

function persistDetails(details: AuthDetails) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Browsing remains available when storage is unavailable.
  }
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
    const details = readStoredDetails();
    set({ initialized: true, details });
    persistDetails(details);
  },

  reconcileDetails: (sessions, activeUid) => {
    get().ensureInitialized();
    set((state) => {
      const storedByUid = new Map(state.details.map(detail => [detail.uid, detail]));
      const reconciled = sessions.map(session => {
        const stored = storedByUid.get(session.uid);
        return {
          ...stored,
          ...session,
          lastLoginAt: session.uid === activeUid ? new Date().toISOString() : stored?.lastLoginAt,
        };
      });
      return { details: reconciled };
    });
  },

  removeGuest: () => {
    get().ensureInitialized();
    set((state) => ({ details: state.details.filter((d) => !d.isGuest) }));
  },
}));

// 订阅 details 变更，自动持久化到 localStorage
useAuthStore.subscribe((state, prevState) => {
  if (state.details !== prevState.details) {
    persistDetails(state.details);
  }
});

export async function syncAuthDetails() {
  const response = await fetch('/api/session?all=true', { cache: 'no-store' });
  if (!response.ok) throw new Error('账号状态同步失败');
  const payload = await response.json() as { data?: Session[]; activeUid?: string | null };
  if (!Array.isArray(payload.data)) throw new Error('账号状态响应无效');
  useAuthStore.getState().reconcileDetails(payload.data, payload.activeUid);
  return payload;
}
