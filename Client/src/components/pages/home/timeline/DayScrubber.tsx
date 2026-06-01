import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { alertDisplayLabel, resolveAlertType } from '@/data/alertTypes';
import {
  formatIsraelClock,
  israelDateTime,
  israelMinutesFromMidnight,
} from '@/lib/israelTime';
import { eventTime, MINUTES_PER_DAY, MS_PER_MINUTE } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useAlertsStore } from '@/store/alertsStore';
import { useTimelineStore } from '@/store/timelineStore';
import type { AlertEvent } from '@/types/alerts';
import type { DayScrubberProps } from '@/types/ui';

function pointerToMinutes(ev: { clientX: number }, track: HTMLElement): number {
  const rect = track.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
  return Math.round(ratio * MINUTES_PER_DAY);
}

function pointerToMs(ev: { clientX: number }, track: HTMLElement, date: string): number {
  const minutes = pointerToMinutes(ev, track);
  return israelDateTime(date, Math.min(minutes, MINUTES_PER_DAY - 1)).getTime();
}

export function DayScrubber({ dayEvents }: DayScrubberProps) {
  const { t, i18n } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const hasCustomRange = useTimelineStore((s) => s.hasCustomRange);
  const rangeStartMs = useTimelineStore((s) => s.rangeStartMs);
  const rangeEndMs = useTimelineStore((s) => s.rangeEndMs);
  const setRangeMs = useTimelineStore((s) => s.setRangeMs);
  const selectEvent = useAlertsStore((s) => s.selectEvent);

  const segments = useMemo(() => {
    return dayEvents
      .map((event) => {
        const eventAt = eventTime(event);
        if (!eventAt) return null;
        const minutes = israelMinutesFromMidnight(eventAt);
        const { color } = resolveAlertType(event);
        const label = alertDisplayLabel(event, i18n.language);
        const clock = formatIsraelClock(minutes, i18n.language);
        return { event, minutes, color, id: event.id, tooltip: `${label} · ${clock}` };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [dayEvents, i18n.language]);

  const startMin = israelMinutesFromMidnight(new Date(rangeStartMs));
  const endMin = israelMinutesFromMidnight(new Date(rangeEndMs));

  const pct = (minutes: number) => (minutes / MINUTES_PER_DAY) * 100;

  const dragHandle = useCallback(
    (which: 'start' | 'end') => (e: React.PointerEvent) => {
      e.preventDefault();
      const track = trackRef.current;
      if (!track) return;

      const move = (ev: PointerEvent) => {
        const ms = pointerToMs(ev, track, selectedDate);

        if (which === 'start') {
          setRangeMs(Math.min(ms, rangeEndMs - MS_PER_MINUTE), rangeEndMs);
        } else {
          setRangeMs(rangeStartMs, Math.max(ms, rangeStartMs + MS_PER_MINUTE));
        }
      };

      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [rangeEndMs, rangeStartMs, selectedDate, setRangeMs],
  );

  const jumpToEvent = (event: AlertEvent) => {
    const eventAt = eventTime(event);
    if (!eventAt) return;
    const center = israelMinutesFromMidnight(eventAt);
    const pad = 15;
    const start = Math.max(0, center - pad);
    const end = Math.min(MINUTES_PER_DAY - 1, center + pad);
    setRangeMs(
      israelDateTime(selectedDate, start).getTime(),
      israelDateTime(selectedDate, end).getTime(),
    );
    selectEvent(event.id);
  };

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 hidden text-xs text-muted-foreground md:block">{t('timeline.dragHint')}</p>
      <div
        ref={trackRef}
        className="relative h-12 rounded-md bg-muted/60 md:h-14"
        role="group"
        aria-label="Time range"
      >
        {segments.map(({ id, minutes, color, event, tooltip }) => (
          <button
            key={id}
            type="button"
            title={tooltip}
            aria-label={tooltip}
            onClick={() => jumpToEvent(event)}
            className="absolute top-2 bottom-2 w-2 rounded-full opacity-90 hover:opacity-100 md:w-2.5"
            style={{ left: `${pct(minutes)}%`, backgroundColor: color }}
          />
        ))}

        {hasCustomRange && (
          <div
            className="absolute inset-y-2 rounded-sm bg-primary/25"
            style={{ left: `${pct(startMin)}%`, width: `${Math.max(pct(endMin) - pct(startMin), 0.5)}%` }}
          />
        )}

        {hasCustomRange && (
          <>
            <div
              role="slider"
              tabIndex={0}
              aria-valuenow={startMin}
              className={cn(
                'absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-sm',
                'border-2 border-primary bg-background shadow',
              )}
              style={{ left: `${pct(startMin)}%` }}
              onPointerDown={dragHandle('start')}
            />
            <div
              role="slider"
              tabIndex={0}
              aria-valuenow={endMin}
              className={cn(
                'absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-sm',
                'border-2 border-primary bg-background shadow',
              )}
              style={{ left: `${pct(endMin)}%` }}
              onPointerDown={dragHandle('end')}
            />
          </>
        )}

        {!hasCustomRange && (
          <button
            type="button"
            className="absolute inset-0 rounded-md hover:bg-primary/5"
            aria-label={t('timeline.dragHint')}
            onPointerDown={(e) => {
              const track = trackRef.current;
              if (!track) return;
              const ms = pointerToMs(e, track, selectedDate);
              const endMinute = Math.min(
                MINUTES_PER_DAY - 1,
                pointerToMinutes(e, track) + 60,
              );
              setRangeMs(ms, israelDateTime(selectedDate, endMinute).getTime());
            }}
          />
        )}
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{t('timeline.midnightStart')}</span>
        <span>{t('timeline.midnightEnd')}</span>
      </div>
    </div>
  );
}
