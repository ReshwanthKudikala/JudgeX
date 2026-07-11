const TOKEN_KEY = 'judgex.auth.token';

/**
 * Thin localStorage helpers for persisted session data.
 * Tokens stay out of the URL and are only attached via Axios Authorization headers.
 */
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private browsing / quota — ignore */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};
