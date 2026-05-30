import { useQuery } from '@tanstack/react-query';
import { getLast24hAlerts, getRecentAlerts } from '@/api/services/alertsService';
import { CONFIG } from '@/data/config';

export const queryKeys = {
  recent: (limit: number) => ['alerts', 'recent', limit] as const,
  last24h: (limit: number) => ['alerts', 'last24h', limit] as const,
};

/**
 * Recent events. Polled on an interval so the map/feed stay fresh even when
 * the IoT realtime channel is unavailable (the realtime layer also invalidates
 * these queries on every push for instant updates).
 */
export function useRecentAlerts(limit: number = CONFIG.RECENT_LIMIT) {
  return useQuery({
    queryKey: queryKeys.recent(limit),
    queryFn: () => getRecentAlerts({ limit }),
    refetchInterval: CONFIG.POLL_INTERVAL_MS,
    staleTime: CONFIG.POLL_INTERVAL_MS,
  });
}

/** Every event from the last 24 hours (drives the feed + analytics). */
export function useLast24hAlerts(limit: number = CONFIG.LAST_24H_LIMIT) {
  return useQuery({
    queryKey: queryKeys.last24h(limit),
    queryFn: () => getLast24hAlerts(limit),
    refetchInterval: CONFIG.POLL_INTERVAL_MS,
    staleTime: CONFIG.POLL_INTERVAL_MS,
  });
}
