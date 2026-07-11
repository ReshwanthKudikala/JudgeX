import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { User } from '@/types';
import { tokenStorage } from '@/utils/storage';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  setSession: (user: User, token: string) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isHydrated: false,

      setSession: (user, token) => {
        tokenStorage.set(token);
        set({ user, token, isLoading: false });
      },

      setUser: (user) => set({ user }),

      setLoading: (isLoading) => set({ isLoading }),

      setHydrated: (isHydrated) => set({ isHydrated }),

      logout: () => {
        tokenStorage.clear();
        set({ user: null, token: null, isLoading: false });
      },

      isAuthenticated: () => Boolean(get().token),
    }),
    {
      name: 'judgex.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
      onRehydrateStorage: () => (state, _error) => {
        // Always mark hydrated — including first visit with empty storage.
        useAuthStore.setState({ isHydrated: true });
        if (state?.token) {
          tokenStorage.set(state.token);
        }
      },
    },
  ),
);
