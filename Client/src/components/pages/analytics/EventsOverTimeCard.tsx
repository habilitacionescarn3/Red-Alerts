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
import {
  AXIS_TICK,
  CHART_MARGIN,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_STYLE,
  Y_AXIS_WIDTH,
} from '@/components/pages/analytics/chartTheme';
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
        {/* Time axes stay LTR in both locales (same convention as the scrubber). */}
        <div className="h-60 w-full sm:h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="alertArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--border)" interval={interval} />
              <YAxis
                tick={AXIS_TICK}
                stroke="var(--border)"
                allowDecimals={false}
                width={Y_AXIS_WIDTH}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
              <Area
                type="monotone"
                dataKey="count"
                name={t('analytics.events')}
                stroke="var(--primary)"
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
