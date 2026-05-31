import { useEffect } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { useAlertsStore } from '@/store/alertsStore';
import { CONFIG } from '@/data/config';
import { categoryMeta } from '@/data/categories';
import type { AlertBroadcast } from '@/types/alerts';
import { IotAlertsClient } from './IotAlertsClient';
import { isIotConfigured } from './config';
import { playAlertSound } from './sound';

function categoryLabel(broadcast: AlertBroadcast): string {
  const category = broadcast.event.category;
  if (category?.label) return category.label;
  const meta = categoryMeta(category?.code);
  return i18n.t(`alerts.categories.${meta.i18nKey}`);
}

function notifyNewAlert(broadcast: AlertBroadcast): void {
  const cities =
    broadcast.added_cities.length > 0
      ? broadcast.added_cities
      : broadcast.event.cities.map((c) => c.name);
  const preview = cities.slice(0, 4).join(', ');
  const more = cities.length > 4 ? ` +${cities.length - 4}` : '';

  toast.error(`${i18n.t('home.newAlertToast')}: ${categoryLabel(broadcast)}`, {
    description: preview ? `${preview}${more}` : undefined,
  });

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
        // The live store merge ([useAlertEvents]) surfaces the new event in the
        // feed/map immediately, so we do NOT invalidate the 24h query here - that
        // would trigger an extra network refetch on every push. The hourly
        // refetch (plus on-focus / on-mount) reconciles with the server.
        ingestBroadcast(broadcast);
        notifyNewAlert(broadcast);
      },
    });

    void client.start();
    return () => {
      client.stop();
    };
  }, [setConnection, ingestBroadcast]);
}
