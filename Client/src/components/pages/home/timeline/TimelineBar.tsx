import { useEffect, useRef } from 'react';
import { Clock, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  formatIsraelClock,
  israelMinutesFromMidnight,
} from '@/lib/israelTime';
import { cn } from '@/lib/utils';
import { useTimelineStore } from '@/store/timelineStore';
import type { TimelineBarProps } from '@/types/ui';
import { DatePickerControl } from './DatePickerControl';
import { DayScrubber } from './DayScrubber';

export function TimelineBar({ dayEvents }: TimelineBarProps) {
  const { t, i18n } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = useTimelineStore((s) => s.isOpen);
  const openTimeline = useTimelineStore((s) => s.openTimeline);
  const closeTimeline = useTimelineStore((s) => s.closeTimeline);
  const setPanelHeightPx = useTimelineStore((s) => s.setPanelHeightPx);
  const hasCustomRange = useTimelineStore((s) => s.hasCustomRange);
  const rangeStartMs = useTimelineStore((s) => s.rangeStartMs);
  const rangeEndMs = useTimelineStore((s) => s.rangeEndMs);
  const clearRange = useTimelineStore((s) => s.clearRange);

  const rangeLabel = hasCustomRange
    ? `${formatIsraelClock(israelMinutesFromMidnight(new Date(rangeStartMs)), i18n.language)} – ${formatIsraelClock(israelMinutesFromMidnight(new Date(rangeEndMs)), i18n.language)}`
    : t('timeline.noRange');

  useEffect(() => {
    if (!isOpen) {
      setPanelHeightPx(0);
      return;
    }
    const el = panelRef.current;
    if (!el) return;

    const report = () => setPanelHeightPx(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setPanelHeightPx(0);
    };
  }, [isOpen, setPanelHeightPx]);

  if (!isOpen) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
        <Button
          type="button"
          size="lg"
          className="pointer-events-auto gap-2 rounded-full shadow-xl"
          onClick={openTimeline}
        >
          <Clock className="size-4" />
          {t('timeline.open')}
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        'absolute inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-lg backdrop-blur-md',
        'max-h-[50svh] md:max-h-none',
      )}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-3 py-3 sm:gap-3 sm:px-4 2xl:max-w-screen-xl">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <DatePickerControl />
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">{rangeLabel}</span>
          {hasCustomRange && (
            <Button type="button" variant="ghost" size="sm" onClick={clearRange}>
              {t('timeline.clearRange')}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={closeTimeline}>
            {t('timeline.backToLive')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t('timeline.close')}
            onClick={closeTimeline}
          >
            <X className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground md:hidden">{t('timeline.dragHint')}</p>
        <DayScrubber dayEvents={dayEvents} />
      </div>
    </div>
  );
}
