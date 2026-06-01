import { useEffect } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { useAlertsStore } from '@/store/alertsStore';
import { queryClient } from '@/api/queryClient';
import { invalidateTodayAlerts } from '@/api/queries';
import { CONFIG } from '@/data/config';
import { alertDisplayLabel } from '@/data/alertTypes';
import type { AlertBroadcast } from '@/types/alerts';
import { IotAlertsClient } from './IotAlertsClient';
import { isIotConfigured } from './config';
import { playAlertSound } from './sound';

function notifyNewAlert(broadcast: AlertBroadcast): void {
  const cities =
    broadcast.added_cities.length > 0
      ? broadcast.added_cities
      : broadcast.event.cities.map((c) => c.name);
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
 * Wires the realtime layer to the store. When IoT is configured it opens the
 * MQTT-over-WSS subscription; otherwise it marks the connection as "polling"
 * (React Query's interval already keeps the data fresh). Call once near the
 * app root.
 */
export function useLiveAlerts(): void {
  const setConnection = useAlertsStore((s) => s.setConnection);
  const ingestBroadcast = useAlertsStore((s) => s.ingestBroadcast);

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
        invalidateTodayAlerts(queryClient);
        notifyNewAlert(broadcast);
      },
    });

    void client.start();
    return () => {
      client.stop();
    };
  }, [setConnection, ingestBroadcast]);
}
