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
import { AXIS_TICK, TOOLTIP_ITEM_STYLE, TOOLTIP_STYLE } from '@/components/pages/analytics/chartTheme';
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
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--border)" interval={2} />
              <YAxis tick={AXIS_TICK} stroke="var(--border)" allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} cursor={{ fill: 'var(--accent)' }} />
              <Bar
                dataKey="count"
                name={t('analytics.events')}
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
