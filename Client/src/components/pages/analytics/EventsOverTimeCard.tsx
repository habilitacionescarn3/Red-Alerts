import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { eventsPerDay, eventsPerHour } from '@/lib/analytics';
import { ISRAEL_TZ } from '@/lib/israelTime';
import { formatClock } from '@/lib/time';
import { AXIS_TICK, TOOLTIP_ITEM_STYLE, TOOLTIP_STYLE } from '@/components/pages/analytics/chartTheme';
import type { AlertEvent, AnalyticsRange } from '@/types/alerts';

interface EventsOverTimeCardProps {
  events: AlertEvent[];
  range: AnalyticsRange;
}

/** Events over the window: hourly buckets for 24h, daily buckets for ranges. */
export function EventsOverTimeCard({ events, range }: EventsOverTimeCardProps) {
  const { i18n, t } = useTranslation();

  const data = useMemo(() => {
    if (range.mode === 'rolling24h') {
      return eventsPerHour(events).map((b) => ({
        label: formatClock(new Date(b.ts), i18n.language),
        count: b.count,
      }));
    }
    const fmt = new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      timeZone: ISRAEL_TZ,
    });
    return eventsPerDay(events, range.fromDate, range.toDate).map((b) => ({
      label: fmt.format(new Date(`${b.date}T12:00:00Z`)),
      count: b.count,
    }));
  }, [events, range, i18n.language]);

  const interval = Math.max(0, Math.ceil(data.length / 12) - 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {range.mode === 'rolling24h'
            ? t('analytics.charts.byHour')
            : t('analytics.charts.byDay')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 24, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="alertArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--border)" interval={interval} />
              <YAxis tick={AXIS_TICK} stroke="var(--border)" allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
              <Area
                type="monotone"
                dataKey="count"
                name={t('analytics.events')}
                stroke="var(--chart-1)"
                fill="url(#alertArea)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
