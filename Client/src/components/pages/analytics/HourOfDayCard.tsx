import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hourOfDayHistogram } from '@/lib/analytics';
import {
  AXIS_TICK,
  CHART_MARGIN,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_STYLE,
  Y_AXIS_WIDTH,
} from '@/components/pages/analytics/chartTheme';
import type { AlertEvent } from '@/types/alerts';

interface HourOfDayCardProps {
  events: AlertEvent[];
}

/** Daily rhythm: events by Israel-local hour of day (00-23). */
export function HourOfDayCard({ events }: HourOfDayCardProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      hourOfDayHistogram(events).map((b) => ({
        label: String(b.hour).padStart(2, '0'),
        count: b.count,
      })),
    [events],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('analytics.charts.hourOfDay')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Time axes stay LTR in both locales (same convention as the scrubber). */}
        <div className="h-60 w-full sm:h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--border)" interval={2} />
              <YAxis
                tick={AXIS_TICK}
                stroke="var(--border)"
                allowDecimals={false}
                width={Y_AXIS_WIDTH}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} cursor={{ fill: 'var(--accent)' }} />
              <Bar
                dataKey="count"
                name={t('analytics.events')}
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
