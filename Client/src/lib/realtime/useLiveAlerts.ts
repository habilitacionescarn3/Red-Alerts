import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { useAlertsStore } from '@/store/alertsStore';
import { queryClient } from '@/api/queryClient';
import { invalidateTodayAlerts, queryKeys } from '@/api/queries';
import { CONFIG } from '@/data/config';
import { alertDisplayLabel } from '@/data/alertTypes';
import type { AlertBroadcast } from '@/types/alerts';
import { IotAlertsClient } from './IotAlertsClient';
import { isIotConfigured } from './config';
import { playAlertSound } from './sound';

function notifyNewAlert(broadcast: AlertBroadcast): void {
  const cities = broadcast.added_cities?.length
    ? broadcast.added_cities
    : (broadcast.event.cities ?? []).map((c) => c.name);
  const preview = cities.slice(0, 4).join(', ');
  const more = cities.length > 4 ? ` +${cities.length - 4}` : '';

  toast.error(
    `${i18n.t('home.newAlertToast')}: ${alertDisplayLabel(broadcast.event, i18n.language)}`,
    {
      description: preview ? `${preview}${more}` : undefined,
    },
  );

  if (CONFIG.ENABLE_ALERT_SOUND) {
    playAlertSound();
  }
}

/**
 * Poll once per second until the given event ID appears in the last-24h cache.
 *
 * Almost every attempt is a CloudFront cache hit (5-second TTL), so Lambda and
 * the DB see at most one origin request per 5-second window regardless of how
 * many browsers are retrying simultaneously.
 *
 * Stops when the event is found, when a newer broadcast supersedes this one
 * (pendingRef changes), or after MAX_ATTEMPTS tries.
 */
const MAX_RETRY_ATTEMPTS = 10;

function scheduleEventRetry(
  eventId: string,
  attempt: number,
  pendingRef: React.MutableRefObject<string | null>,
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
): void {
  if (attempt >= MAX_RETRY_ATTEMPTS) return;

  timerRef.current = setTimeout(() => {
    if (pendingRef.current !== eventId) return; // superseded by a newer broadcast

    const data = queryClient.getQueryData<{ events: Array<{ id: string }> }>(
      queryKeys.last24h(CONFIG.LAST_24H_LIMIT),
    );

    if (data?.events?.some((e) => e.id === eventId)) {
      pendingRef.current = null;
      return;
    }

    // Event not yet in the cache — CloudFront may still be serving a response
    // from before the broadcast. Invalidate to trigger a fresh fetch and retry.
    invalidateTodayAlerts(queryClient);
    scheduleEventRetry(eventId, attempt + 1, pendingRef, timerRef);
  }, 1000);
}

/**
 * Wires the realtime layer to the store. When IoT is configured it opens the
 * MQTT-over-WSS subscription; otherwise it marks the connection as "polling"
 * (React Query's interval already keeps the data fresh). Call once near the
 * app root.
 */
export function useLiveAlerts(): void {
  const setConnection = useAlertsStore((s) => s.setConnection);
  const ingestBroadcast = useAlertsStore((s) => s.ingestBroadcast);

  const pendingEventIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isIotConfigured()) {
      setConnection('polling');
      return;
    }

    const client = new IotAlertsClient({
      onStatus: (status) => {
        setConnection(status);
      },
      onBroadcast: (broadcast) => {
        ingestBroadcast(broadcast);
        notifyNewAlert(broadcast);

        // Cancel any in-flight retry for the previous broadcast.
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        pendingEventIdRef.current = broadcast.event.id;

        // Immediate invalidation — triggers a background refetch without any
        // visible loading state (isLoading stays false; existing data is kept).
        invalidateTodayAlerts(queryClient);

        // Safety-net: if the first fetch returns a stale CloudFront response
        // (the 5s cache hasn't expired yet), retry every second until the event
        // appears or we've tried MAX_RETRY_ATTEMPTS times.
        scheduleEventRetry(broadcast.event.id, 0, pendingEventIdRef, retryTimerRef);
      },
    });

    void client.start();
    return () => {
      client.stop();
      // Nulling the pending ID stops the retry chain: scheduleEventRetry bails
      // immediately when pendingRef.current !== eventId, so no further retries
      // or invalidations happen after the component unmounts.
      pendingEventIdRef.current = null;
    };
  }, [setConnection, ingestBroadcast]);
}
