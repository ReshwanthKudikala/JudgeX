import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { clearAllDrafts } from '@/features/editor/persistence';
import type { User } from '@/types';
import {
  AUTH_PERSIST_KEY,
  authPersistStorage,
  getRememberMePreference,
  setRememberMePreference,
} from '@/utils/auth-storage';
import { tokenStorage } from '@/utils/storage';

interface AuthState {
  user: User | null;
  token: string | null;
  rememberMe: boolean;
  isLoading: boolean;
  isValidatingSession: boolean;
  setSession: (user: User, token: string, rememberMe?: boolean) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setValidatingSession: (validating: boolean) => void;
  setRememberMe: (remember: boolean) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      rememberMe: getRememberMePreference(),
      isLoading: false,
      isValidatingSession: false,

      setSession: (user, token, rememberMe = get().rememberMe) => {
        setRememberMePreference(rememberMe);
        tokenStorage.set(token);
        set({
          user,
          token,
          rememberMe,
          isLoading: false,
          isValidatingSession: false,
        });
      },

      setUser: (user) => set({ user }),

      setLoading: (isLoading) => set({ isLoading }),

      setValidatingSession: (isValidatingSession) =>
        set({ isValidatingSession }),

      setRememberMe: (rememberMe) => {
        setRememberMePreference(rememberMe);
        set({ rememberMe });
      },

      logout: () => {
        tokenStorage.clear();
        authPersistStorage.removeItem(AUTH_PERSIST_KEY);
        // Drafts are not keyed by user — wipe so the next session cannot reuse them.
        clearAllDrafts();
        set({
          user: null,
          token: null,
          isLoading: false,
          isValidatingSession: false,
        });
      },

      isAuthenticated: () => Boolean(get().token),
    }),
    {
      name: AUTH_PERSIST_KEY,
      storage: createJSONStorage(() => authPersistStorage),

      partialize: (state) => ({
        user: state.user,
        token: state.token,
        rememberMe: state.rememberMe,
      }),
    },
  ),
);
