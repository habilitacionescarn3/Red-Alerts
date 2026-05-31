import { useMemo } from 'react';
import { useLast24hAlerts } from '@/api/queries';
import { useAlertsStore } from '@/store/alertsStore';
import { CONFIG } from '@/data/config';
import { useNow } from '@/hooks/useNow';
import { eventTime, isActive } from '@/lib/time';
import type { AlertEvent, LngLat } from '@/types/alerts';

/** City id -> geocoded points (null until resolved). */
export type CityCoords = Map<string, LngLat[] | null>;

export interface AlertEventsResult {
  /** All events (server + live), deduped, newest-first. */
  events: AlertEvent[];
  /** Events whose last_seen_at falls within the active window. */
  activeEvents: AlertEvent[];
  /** Per-city points (server `cities` merged with live broadcasts), keyed by id. */
  cityCoords: CityCoords;
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
  const liveCityCoords = useAlertsStore((s) => s.liveCityCoords);
  const now = useNow();

  const events = useMemo(() => {
    const byId = new Map<string, AlertEvent>();
    for (const event of query.data?.events ?? []) byId.set(event.id, event);
    // Live events override server copies (they are at least as fresh).
    for (const event of liveEvents) byId.set(event.id, event);

    return Array.from(byId.values()).sort((a, b) => {
      const ta = eventTime(a)?.getTime() ?? 0;
      const tb = eventTime(b)?.getTime() ?? 0;
      return tb - ta;
    });
  }, [query.data, liveEvents]);

  // Per-city points: the server `cities` array, then live broadcasts layered on
  // top (a live point upgrades/overrides the server copy for the same city).
  const cityCoords = useMemo<CityCoords>(() => {
    const map: CityCoords = new Map();
    for (const city of query.data?.cities ?? []) map.set(city.id, city.coordinates);
    for (const [id, points] of Object.entries(liveCityCoords)) map.set(id, points);
    return map;
  }, [query.data, liveCityCoords]);

  // Depends on `now` so events drop out of the active (red) window on time as
  // the clock advances, even with no new data arriving.
  const activeEvents = useMemo(
    () => events.filter((e) => isActive(e, CONFIG.ACTIVE_ALERT_WINDOW_MINUTES)),
    [events, now],
  );

  return {
    events,
    activeEvents,
    cityCoords,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
