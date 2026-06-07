import { useQuery } from '@tanstack/react-query';
import {
  getAlertDates,
  getAlertsByDate,
  getLast24hAlerts,
  getRecentAlerts,
} from '@/api/services/alertsService';
import { CONFIG } from '@/data/config';
import { israelDateString } from '@/lib/israelTime';

export const queryKeys = {
  recent: (limit: number) => ['alerts', 'recent', limit] as const,
  last24h: (limit: number) => ['alerts', 'last24h', limit] as const,
  datesInMonth: (year: number, month: number) => ['alerts', 'dates', year, month] as const,
  byDate: (date: string, limit: number) => ['alerts', 'by-date', date, limit] as const,
};

const DATES_STALE_MS = 3_600_000;
const TODAY_BY_DATE_STALE_MS = 300_000;

export function isTodayIsrael(date: string): boolean {
  return date === israelDateString();
}

/**
 * Recent events. Polled on an interval so the map/feed stay fresh even when
 * the IoT realtime channel is unavailable.
 */
export function useRecentAlerts(limit: number = CONFIG.RECENT_LIMIT) {
  return useQuery({
    queryKey: queryKeys.recent(limit),
    queryFn: () => getRecentAlerts({ limit }),
    refetchInterval: CONFIG.POLL_INTERVAL_MS,
    staleTime: CONFIG.POLL_INTERVAL_MS,
  });
}

/** Every event from the last 24 hours (drives analytics). */
export function useLast24hAlerts(limit: number = CONFIG.LAST_24H_LIMIT) {
  return useQuery({
    queryKey: queryKeys.last24h(limit),
    queryFn: () => getLast24hAlerts(limit),
    refetchInterval: CONFIG.LAST_24H_REFETCH_MS,
    staleTime: CONFIG.LAST_24H_REFETCH_MS,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

/** Israel-local dates in a month that have at least one event. */
export function useAlertDatesInMonth(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.datesInMonth(year, month),
    queryFn: () => getAlertDates(year, month),
    staleTime: DATES_STALE_MS,
  });
}

/** All events on an Israel-local day (cached; today stays short-lived). */
export function useAlertsByDate(date: string, limit: number = CONFIG.LAST_24H_LIMIT) {
  const today = isTodayIsrael(date);
  return useQuery({
    queryKey: queryKeys.byDate(date, limit),
    queryFn: () => getAlertsByDate(date, limit),
    staleTime: today ? TODAY_BY_DATE_STALE_MS : Number.POSITIVE_INFINITY,
    enabled: Boolean(date),
    refetchOnWindowFocus: today,
  });
}

/** Invalidate today's alert caches after a live broadcast (triggers background refetch). */
export function invalidateTodayAlerts(queryClient: {
  invalidateQueries: (opts: { queryKey: readonly unknown[] }) => void;
}): void {
  const today = israelDateString();
  // last-24h is the primary source for the feed and map — must be invalidated
  // so the new event's full city data arrives without waiting for the hourly tick.
  queryClient.invalidateQueries({ queryKey: queryKeys.last24h(CONFIG.LAST_24H_LIMIT) });
  queryClient.invalidateQueries({
    queryKey: queryKeys.byDate(today, CONFIG.LAST_24H_LIMIT),
  });
  const [year, month] = today.split('-').map(Number);
  queryClient.invalidateQueries({ queryKey: queryKeys.datesInMonth(year, month) });
}
