import { useEffect, useState } from 'react';

import { useAuthStore } from '@/store/auth.store';

/**
 * Subscribe to Zustand persist hydration using the v5 persist API.
 * Handles both cases:
 * - hydration already finished before this hook mounts (`hasHydrated()`)
 * - hydration finishes later (`onFinishHydration`)
 */
export function useAuthHydration(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist.hasHydrated(),
  );

  useEffect(() => {
    setHydrated(useAuthStore.persist.hasHydrated());

    return useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}
