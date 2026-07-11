/** Paths that require a valid JWT (must stay in sync with the router). */
const PROTECTED_PREFIXES = ['/profile'] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

type UnauthorizedListener = (info: { message: string }) => void;

let unauthorizedListener: UnauthorizedListener | null = null;

export function setUnauthorizedListener(listener: UnauthorizedListener | null): void {
  unauthorizedListener = listener;
}

export function notifyUnauthorized(message: string): void {
  unauthorizedListener?.({ message });
}
