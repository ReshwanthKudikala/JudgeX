import { useEffect, useMemo, useState } from 'react';

/** Live countdown to a target ISO timestamp. Returns null when target passed / invalid. */
export function useCountdown(targetIso: string | null | undefined) {
  const targetMs = useMemo(() => {
    if (!targetIso) return null;
    const t = new Date(targetIso).getTime();
    return Number.isFinite(t) ? t : null;
  }, [targetIso]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs == null) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  if (targetMs == null) {
    return { totalMs: 0, expired: true, label: '—' };
  }

  const totalMs = Math.max(0, targetMs - now);
  const expired = totalMs <= 0;
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${String(hours).padStart(2, '0')}h`);
  parts.push(`${String(minutes).padStart(2, '0')}m`);
  parts.push(`${String(seconds).padStart(2, '0')}s`);

  return {
    totalMs,
    expired,
    days,
    hours,
    minutes,
    seconds,
    label: expired ? '00h 00m 00s' : parts.join(' '),
  };
}
