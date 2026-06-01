import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAlertDatesInMonth } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { israelDateString, parseIsraelYearMonth } from '@/lib/israelTime';
import { cn } from '@/lib/utils';
import { useTimelineStore } from '@/store/timelineStore';

function dateFromIsraelString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

export function DatePickerControl() {
  const { i18n, t } = useTranslation();
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const setSelectedDate = useTimelineStore((s) => s.setSelectedDate);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(selectedDate);

  const { year, month } = parseIsraelYearMonth(viewMonth);
  const datesQuery = useAlertDatesInMonth(year, month);
  const eventDates = useMemo(() => new Set(datesQuery.data?.dates ?? []), [datesQuery.data]);

  const selected = useMemo(() => dateFromIsraelString(selectedDate), [selectedDate]);
  const monthDate = useMemo(() => dateFromIsraelString(`${viewMonth.slice(0, 7)}-01`), [viewMonth]);

  const formattedSelected = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Jerusalem',
      }).format(selected),
    [selected, i18n.language],
  );

  const hasEvents = (date: Date) => eventDates.has(israelDateString(date));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 shrink-0">
          <CalendarDays className="size-4" />
          <span className="max-w-[200px] truncate">{formattedSelected}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          month={monthDate}
          onMonthChange={(month) => setViewMonth(israelDateString(month))}
          onSelect={(date) => {
            if (!date) return;
            setSelectedDate(israelDateString(date));
            setOpen(false);
          }}
          modifiers={{ hasEvents }}
          modifiersClassNames={{
            hasEvents: cn(
              'bg-red-500/15 text-red-600 dark:text-red-400',
              'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground',
            ),
          }}
        />
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">{t('timeline.datesHint')}</p>
      </PopoverContent>
    </Popover>
  );
}
