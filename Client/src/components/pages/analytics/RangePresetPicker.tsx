import { useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DateRange } from 'react-day-picker';
import { useAlertDatesInMonth } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ISRAEL_TZ, israelDateString, parseIsraelYearMonth } from '@/lib/israelTime';
import { cn } from '@/lib/utils';
import { useAnalyticsFilterStore } from '@/store/analyticsFilterStore';

const PRESETS = [
  { preset: '24h', labelKey: 'analytics.filters.last24h' },
  { preset: '7d', labelKey: 'analytics.filters.last7d' },
  { preset: '30d', labelKey: 'analytics.filters.last30d' },
] as const;

/** Noon-anchored UTC instant for an Israel-local date (safe for calendar UI). */
function dateFromIsraelString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

/** Time-range presets + a custom from/to calendar (range mode, max 31 days). */
export function RangePresetPicker() {
  const { i18n, t } = useTranslation();
  const preset = useAnalyticsFilterStore((s) => s.preset);
  const customFrom = useAnalyticsFilterStore((s) => s.customFrom);
  const customTo = useAnalyticsFilterStore((s) => s.customTo);
  const setPreset = useAnalyticsFilterStore((s) => s.setPreset);
  const setCustomRange = useAnalyticsFilterStore((s) => s.setCustomRange);

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(israelDateString());
  const [draft, setDraft] = useState<DateRange | undefined>();

  const { year, month } = parseIsraelYearMonth(viewMonth);
  const datesQuery = useAlertDatesInMonth(year, month);
  const eventDates = useMemo(() => new Set(datesQuery.data?.dates ?? []), [datesQuery.data]);
  const hasEvents = (date: Date) => eventDates.has(israelDateString(date));

  const customLabel = useMemo(() => {
    if (preset !== 'custom' || !customFrom || !customTo) return t('analytics.filters.custom');
    const fmt = new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      timeZone: ISRAEL_TZ,
    });
    return `${fmt.format(dateFromIsraelString(customFrom))} – ${fmt.format(dateFromIsraelString(customTo))}`;
  }, [preset, customFrom, customTo, i18n.language, t]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map(({ preset: p, labelKey }) => (
        <Button
          key={p}
          size="sm"
          variant={preset === p ? 'default' : 'outline'}
          onClick={() => setPreset(p)}
        >
          {t(labelKey)}
        </Button>
      ))}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setDraft(
              preset === 'custom' && customFrom && customTo
                ? {
                    from: dateFromIsraelString(customFrom),
                    to: dateFromIsraelString(customTo),
                  }
                : undefined,
            );
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={preset === 'custom' ? 'default' : 'outline'}
            className="gap-2"
          >
            <CalendarRange className="size-4" />
            <span className="max-w-[200px] truncate">{customLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={draft}
            month={dateFromIsraelString(`${viewMonth.slice(0, 7)}-01`)}
            onMonthChange={(m) => setViewMonth(israelDateString(m))}
            disabled={{ after: new Date() }}
            onSelect={setDraft}
            modifiers={{ hasEvents }}
            modifiersClassNames={{
              hasEvents: cn(
                'bg-red-500/15 text-red-600 dark:text-red-400',
                'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground',
              ),
            }}
          />
          <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
            <p className="max-w-56 text-xs text-muted-foreground">
              {t('analytics.filters.pickRange')}
            </p>
            <Button
              size="xs"
              disabled={!draft?.from}
              onClick={() => {
                if (!draft?.from) return;
                // The store clamps the span to RANGE_MAX_DAYS and to <= today.
                setCustomRange(
                  israelDateString(draft.from),
                  israelDateString(draft.to ?? draft.from),
                );
                setOpen(false);
              }}
            >
              {t('analytics.filters.apply')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
