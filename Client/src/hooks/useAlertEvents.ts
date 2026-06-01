import { useMemo } from 'react';
import { useLast24hAlerts } from '@/api/queries';
import { useAlertsStore } from '@/store/alertsStore';
import { useNow } from '@/hooks/useNow';
import {
  buildCityCoordsMap,
  filterActiveEvents,
  mergeAlertEvents,
} from '@/lib/alerts/events';
import type { AlertEventsResult } from '@/types/alerts';

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

  const events = useMemo(
    () => mergeAlertEvents(query.data?.events ?? [], liveEvents, true),
    [query.data, liveEvents],
  );

  const cityCoords = useMemo(
    () => buildCityCoordsMap([query.data?.cities ?? []], liveCityCoords),
    [query.data, liveCityCoords],
  );

  const activeEvents = useMemo(() => filterActiveEvents(events), [events, now]);

  return {
    events,
    activeEvents,
    cityCoords,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
