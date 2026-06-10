import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTypeIcon } from '@/components/shared/AlertTypeIcon';
import { alertDisplayLabel, alertTypeBg, resolveAlertType } from '@/data/alertTypes';
import { useLocalizeCityName } from '@/hooks/useLocalizeCityName';
import { ISRAEL_TZ } from '@/lib/israelTime';
import { eventTime } from '@/lib/time';
import type { AlertEvent } from '@/types/alerts';

// One formatter per language (Intl.DateTimeFormat construction is expensive
// and this renders in a long list).
const formatters = new Map<string, Intl.DateTimeFormat>();
function timeFormatter(language: string): Intl.DateTimeFormat {
  let fmt = formatters.get(language);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(language, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: ISRAEL_TZ,
    });
    formatters.set(language, fmt);
  }
  return fmt;
}

interface AnalyticsHistoryItemProps {
  event: AlertEvent;
}

/**
 * Static (non-interactive) history row. Deliberately NOT AlertFeedItem: that
 * one is a selectable button with relative timestamps re-rendering on a 30s
 * tick — wrong for a long historical list, which wants absolute Israel times.
 */
function AnalyticsHistoryItemBase({ event }: AnalyticsHistoryItemProps) {
  const { i18n, t } = useTranslation();
  const localize = useLocalizeCityName();
  const alertType = resolveAlertType(event);
  const label = alertDisplayLabel(event, i18n.language);
  const time = eventTime(event);
  const timeLabel = time ? timeFormatter(i18n.language).format(time) : '';
  const cityNames = event.cities.map((c) => localize(c.name));

  return (
    <div
      className="rounded-lg border border-s-4 bg-card p-3"
      style={{ borderInlineStartColor: alertType.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md"
            style={{ color: alertType.color, backgroundColor: alertTypeBg(alertType.color) }}
          >
            <AlertTypeIcon icon={alertType.icon} />
          </span>
          <span className="text-sm">{label}</span>
        </div>
        <time className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeLabel}</time>
      </div>
      <p className="mt-2 line-clamp-2 text-sm">
        {cityNames.length > 0 ? cityNames.join(', ') : t('alerts.unknownArea')}
      </p>
    </div>
  );
}

export const AnalyticsHistoryItem = memo(AnalyticsHistoryItemBase);
