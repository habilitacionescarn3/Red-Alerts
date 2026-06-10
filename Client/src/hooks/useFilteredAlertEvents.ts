import { useMemo } from 'react';
import { useAlertsByDate, useLast24hAlerts } from '@/api/queries';
import { CONFIG } from '@/data/config';
import { useNow } from '@/hooks/useNow';
import { israelDateString } from '@/lib/israelTime';
import {
  buildCityCoordsMap,
  filterActiveEvents,
  filterEventsByRange,
  filterEventsLastMinutes,
  mergeAlertEvents,
} from '@/lib/alerts/events';
import { useAlertsStore } from '@/store/alertsStore';
import { useTimelineStore } from '@/store/timelineStore';
import type { FilteredAlertEventsResult } from '@/types/alerts';

/**
 * Home data layer: feed and map use different default windows unless the user
 * picks a time range on the bottom scrubber.
 */
export function useFilteredAlertEvents(): FilteredAlertEventsResult {
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const hasCustomRange = useTimelineStore((s) => s.hasCustomRange);
  const rangeStartMs = useTimelineStore((s) => s.rangeStartMs);
  const rangeEndMs = useTimelineStore((s) => s.rangeEndMs);
  const timelineOpen = useTimelineStore((s) => s.isOpen);

  // Day data only feeds the timeline scrubber / custom-range views, so don't
  // fetch it until the timeline opens - otherwise the home page fires two
  // heavy requests (last-24h AND by-date=today) on every load.
  const dayQueryEnabled = timelineOpen || hasCustomRange;

  const last24hQuery = useLast24hAlerts();
  const dayQuery = useAlertsByDate(selectedDate, CONFIG.LAST_24H_LIMIT, dayQueryEnabled);
  const liveEvents = useAlertsStore((s) => s.liveEvents);
  const liveCityCoords = useAlertsStore((s) => s.liveCityCoords);
  const now = useNow();

  const today = israelDateString(new Date(now));
  const includeLive = selectedDate === today;

  const events24h = useMemo(
    () => mergeAlertEvents(last24hQuery.data?.events ?? [], liveEvents, true),
    [last24hQuery.data, liveEvents],
  );

  const dayEvents = useMemo(
    () => mergeAlertEvents(dayQuery.data?.events ?? [], liveEvents, includeLive),
    [dayQuery.data, liveEvents, includeLive],
  );

  const feedEvents = useMemo(() => {
    if (!hasCustomRange) return events24h;
    return filterEventsByRange(dayEvents, rangeStartMs, rangeEndMs);
  }, [hasCustomRange, events24h, dayEvents, rangeStartMs, rangeEndMs]);

  const mapEvents = useMemo(() => {
    if (!hasCustomRange) {
      return filterEventsLastMinutes(events24h, CONFIG.ACTIVE_ALERT_WINDOW_MINUTES, now);
    }
    return filterEventsByRange(dayEvents, rangeStartMs, rangeEndMs);
  }, [hasCustomRange, events24h, dayEvents, rangeStartMs, rangeEndMs, now]);

  const cityCoords = useMemo(
    () =>
      buildCityCoordsMap(
        [last24hQuery.data?.cities ?? [], dayQuery.data?.cities ?? []],
        liveCityCoords,
      ),
    [last24hQuery.data, dayQuery.data, liveCityCoords],
  );

  const activeEvents = useMemo(() => filterActiveEvents(mapEvents), [mapEvents, now]);

  return {
    feedEvents,
    mapEvents,
    activeEvents,
    cityCoords,
    dayEvents,
    isLoading: last24hQuery.isLoading || dayQuery.isLoading,
    isError: last24hQuery.isError || dayQuery.isError,
    refetch: () => {
      void last24hQuery.refetch();
      // refetch() ignores `enabled`, so guard it - a disabled day query must
      // not fire on the home page's mount-refresh.
      if (dayQueryEnabled) void dayQuery.refetch();
    },
  };
}
