import { memo, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/shared/CategoryIcon';
import { categoryMeta, SEVERITY_CLASSES } from '@/data/categories';
import { useNow } from '@/hooks/useNow';
import { eventTime, formatRelative } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { AlertEvent } from '@/types/alerts';

const SEVERITY_ACCENT = {
  critical: 'border-s-red-500',
  high: 'border-s-orange-500',
  medium: 'border-s-amber-500',
  info: 'border-s-sky-500',
} as const;

export interface AlertFeedItemProps {
  event: AlertEvent;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (event: AlertEvent) => void;
}

function AlertFeedItemBase({ event, isSelected, isActive, onSelect }: AlertFeedItemProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const ref = useRef<HTMLButtonElement>(null);
  const meta = categoryMeta(event.category?.code);
  const label = event.category?.label || t(`alerts.categories.${meta.i18nKey}`);
  const cityNames = event.cities.map((c) => c.name);
  // Recompute the relative time on every tick so "2 minutes ago" keeps climbing
  // while the page is idle (formatRelative reads the wall clock each call).
  const time = useMemo(
    () => formatRelative(eventTime(event), i18n.language),
    [event, i18n.language, now],
  );

  // Reveal the item when it becomes selected (e.g. from a click on the map).
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
        SEVERITY_ACCENT[meta.severity],
        isSelected && 'ring-2 ring-primary',
        isActive && 'alert-pulse',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <span className={cn('flex size-7 items-center justify-center rounded-md', SEVERITY_CLASSES[meta.severity])}>
            <CategoryIcon code={event.category?.code} />
          </span>
          <span className="text-sm">{label}</span>
        </div>
        <time className="shrink-0 text-xs text-muted-foreground">{time}</time>
      </div>

      {event.title?.text && (
        <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{event.title.text}</p>
      )}

      <p className="mt-2 line-clamp-2 text-sm">
        {cityNames.length > 0 ? cityNames.join(', ') : t('alerts.unknownArea')}
      </p>
    </button>
  );
}

export const AlertFeedItem = memo(AlertFeedItemBase);
