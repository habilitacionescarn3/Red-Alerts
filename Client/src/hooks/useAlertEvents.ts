import { useMemo } from 'react';
import { useLast24hAlerts } from '@/api/queries';
import { useAlertsStore } from '@/store/alertsStore';
import { CONFIG } from '@/data/config';
import { eventTime, isActive } from '@/lib/time';
import type { AlertEvent } from '@/types/alerts';

export interface AlertEventsResult {
  /** All events (server + live), deduped, newest-first. */
  events: AlertEvent[];
  /** Events whose last_seen_at falls within the active window. */
  activeEvents: AlertEvent[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Canonical event list for the UI: the 24h server query merged with the live
 * (IoT) ring buffer so brand-new alerts appear instantly, before the next
 * server refetch catches up. Deduped by event id (live wins), sorted by time.
 */
export function useAlertEvents(): AlertEventsResult {
  const query = useLast24hAlerts();
  const liveEvents = useAlertsStore((s) => s.liveEvents);

  const events = useMemo(() => {
    const byId = new Map<string, AlertEvent>();
    for (const event of query.data ?? []) byId.set(event.id, event);
    // Live events override server copies (they are at least as fresh).
    for (const event of liveEvents) byId.set(event.id, event);

    return Array.from(byId.values()).sort((a, b) => {
      const ta = eventTime(a)?.getTime() ?? 0;
      const tb = eventTime(b)?.getTime() ?? 0;
      return tb - ta;
    });
  }, [query.data, liveEvents]);

  const activeEvents = useMemo(
    () => events.filter((e) => isActive(e, CONFIG.ACTIVE_ALERT_WINDOW_MINUTES)),
    [events],
  );

  return {
    events,
    activeEvents,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
