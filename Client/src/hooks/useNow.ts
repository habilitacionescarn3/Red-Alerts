import { useEffect, useState } from 'react';

/** How often "now" advances. 30s keeps relative times + the active window fresh. */
const TICK_MS = 30_000;

// One shared interval drives every subscriber, so a long feed of items doesn't
// spin up hundreds of timers - they all re-render off the same tick.
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function ensureTimer(): void {
  if (timer) return;
  timer = setInterval(() => {
    for (const notify of subscribers) notify();
  }, TICK_MS);
}

function stopTimerIfIdle(): void {
  if (timer && subscribers.size === 0) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Returns the current time (ms) and re-renders the calling component every 30s.
 * Use it where relative times ("X minutes ago") or time-windowed state must keep
 * advancing while the page sits idle, without polling the server.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const notify = () => setNow(Date.now());
    subscribers.add(notify);
    ensureTimer();
    return () => {
      subscribers.delete(notify);
      stopTimerIfIdle();
    };
  }, []);

  return now;
}
