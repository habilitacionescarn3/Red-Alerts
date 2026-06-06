import { useTranslation } from 'react-i18next';
import { useAlertsStore } from '@/store/alertsStore';
import type { ConnectionStatus } from '@/types/alerts';
import { cn } from '@/lib/utils';

const DOT_CLASSES: Record<ConnectionStatus, string> = {
  idle: 'bg-muted-foreground',
  connecting: 'bg-amber-500 animate-pulse',
  connected: 'bg-emerald-500',
  polling: 'bg-sky-500',
  offline: 'bg-red-500',
};

const LABEL_KEYS: Record<ConnectionStatus, string> = {
  idle: 'live.connecting',
  connecting: 'live.connecting',
  connected: 'live.connected',
  polling: 'live.polling',
  offline: 'live.offline',
};

export function LiveIndicator() {
  const { t } = useTranslation();
  const connection = useAlertsStore((s) => s.connection);

  const statusLabel = t(LABEL_KEYS[connection]);

  return (
    <div
      className="flex items-center gap-2 rounded-full border px-1.5 py-1 text-xs font-medium text-muted-foreground sm:px-2.5"
      title={statusLabel}
      aria-label={statusLabel}
    >
      <span className={cn('size-2 shrink-0 rounded-full', DOT_CLASSES[connection])} />
      <span className="hidden sm:inline">{t('live.label')}</span>
      <span className="hidden text-foreground/80 sm:inline">{statusLabel}</span>
    </div>
  );
}
