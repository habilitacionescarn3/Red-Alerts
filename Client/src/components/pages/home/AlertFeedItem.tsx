import { memo, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTypeIcon } from '@/components/shared/AlertTypeIcon';
import {
  alertDisplayLabel,
  alertTypeBg,
  instructionDisplay,
  resolveAlertType,
  titleInstruction,
} from '@/data/alertTypes';
import { useLocalizeCityName } from '@/hooks/useLocalizeCityName';
import { useNow } from '@/hooks/useNow';
import { eventTime, formatRelative } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { AlertFeedItemProps } from '@/types/ui';

function AlertFeedItemBase({ event, isSelected, isActive, onSelect }: AlertFeedItemProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const ref = useRef<HTMLButtonElement>(null);
  const alertType = resolveAlertType(event);
  const label = alertDisplayLabel(event, i18n.language);
  const instruction = titleInstruction(event.title?.text);
  const subtitle = useMemo(() => {
    if (instruction) return instructionDisplay(instruction, i18n.language);
    if (alertType.key === 'eventEnded') return t('alerts.eventEndedHint');
    if (event.description?.text) return instructionDisplay(event.description.text, i18n.language);
    return null;
  }, [instruction, alertType.key, event.description?.text, i18n.language, t]);
  const localize = useLocalizeCityName();
  const cityNames = event.cities.map((c) => localize(c.name));
  const time = useMemo(
    () => formatRelative(eventTime(event), i18n.language),
    [event, i18n.language, now],
  );

  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [isSelected]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(event)}
      className={cn(
        'w-full rounded-lg border border-s-4 bg-card p-3 text-start transition-colors hover:bg-accent',
        isSelected && 'ring-2 ring-primary',
        isActive && 'alert-pulse',
      )}
      style={{ borderInlineStartColor: alertType.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <span
            className="flex size-7 items-center justify-center rounded-md"
            style={{ color: alertType.color, backgroundColor: alertTypeBg(alertType.color) }}
          >
            <AlertTypeIcon icon={alertType.icon} />
          </span>
          <span className="text-sm">{label}</span>
        </div>
        <time className="shrink-0 text-xs text-muted-foreground">{time}</time>
      </div>

      {subtitle && (
        <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>
      )}

      <p className="mt-2 line-clamp-2 text-sm">
        {cityNames.length > 0 ? cityNames.join(', ') : t('alerts.unknownArea')}
      </p>
    </button>
  );
}

export const AlertFeedItem = memo(AlertFeedItemBase);
