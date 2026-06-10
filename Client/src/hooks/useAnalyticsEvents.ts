import { useEffect, useMemo } from 'react';
import { useAlertsRange, useLast24hAlerts } from '@/api/queries';
import { CONFIG } from '@/data/config';
import {
  buildCityCoordsMap,
  filterActiveEvents,
  mergeAlertEvents,
} from '@/lib/alerts/events';
import { israelDateString } from '@/lib/israelTime';
import { useNow } from '@/hooks/useNow';
import { resolveAnalyticsRange, useAnalyticsFilterStore } from '@/store/analyticsFilterStore';
import { useAlertsStore } from '@/store/alertsStore';
import type { AnalyticsEventsResult } from '@/types/alerts';

/**
 * Event source for the Analytics page, driven by the filter store's range:
 * the rolling-24h query for the '24h' preset, or one cached `/alerts/range`
 * query for multi-day windows. Live (IoT) events merge in whenever the window
 * includes today, exactly like the HomePage feed.
 */
export function useAnalyticsEvents(): AnalyticsEventsResult {
  const preset = useAnalyticsFilterStore((s) => s.preset);
  const customFrom = useAnalyticsFilterStore((s) => s.customFrom);
  const customTo = useAnalyticsFilterStore((s) => s.customTo);
  const liveEvents = useAlertsStore((s) => s.liveEvents);
  const liveCityCoords = useAlertsStore((s) => s.liveCityCoords);
  const now = useNow();

  // israelDateString() is re-read on every useNow tick, so a 7d/30d window
  // rolls forward when midnight (Israel) passes while the page is open.
  const today = israelDateString(new Date(now));
  const range = useMemo(
    () => resolveAnalyticsRange({ preset, customFrom, customTo }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, customFrom, customTo, today],
  );

  const isRolling = range.mode === 'rolling24h';
  const last24h = useLast24hAlerts();
  const rangeQuery = useAlertsRange(
    range.mode === 'range' ? range.fromDate : '',
    range.mode === 'range' ? range.toDate : '',
  );

  const active = isRolling ? last24h : rangeQuery;
  const includeLive = isRolling || (range.mode === 'range' && range.toDate >= today);

  const events = useMemo(
    () => mergeAlertEvents(active.data?.events ?? [], liveEvents, includeLive),
    [active.data, liveEvents, includeLive],
  );

  const cityCoords = useMemo(
    () => buildCityCoordsMap([active.data?.cities ?? []], liveCityCoords),
    [active.data, liveCityCoords],
  );

  const activeEvents = useMemo(
    () => (includeLive ? filterActiveEvents(events) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, includeLive, now],
  );

  // A response that fills the limit means the window was truncated server-side.
  useEffect(() => {
    if (!isRolling && (rangeQuery.data?.events.length ?? 0) >= CONFIG.RANGE_LIMIT) {
      console.warn(
        `Analytics range hit the ${CONFIG.RANGE_LIMIT}-event limit; counts may undercount this window.`,
      );
    }
  }, [isRolling, rangeQuery.data]);

  return {
    events,
    activeEvents,
    cityCoords,
    range,
    isLoading: active.isLoading,
    isError: active.isError,
    refetch: () => void active.refetch(),
  };
}
