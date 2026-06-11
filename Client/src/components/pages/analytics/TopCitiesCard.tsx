import { useMemo, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLocalizeCityName } from '@/hooks/useLocalizeCityName';
import { AXIS_TICK, TOOLTIP_ITEM_STYLE, TOOLTIP_STYLE } from '@/components/pages/analytics/chartTheme';
import type { CityCount } from '@/types/alerts';

const COLLAPSED_ROWS = 10;
const EXPANDED_ROWS = 30;
const ROW_PX = 26;

interface TopCitiesCardProps {
  /** Full per-city counts of the filtered window, sorted desc (raw names). */
  cities: CityCount[];
}

/** Most-alerted cities, horizontal bars; expandable 10 -> 30 rows. */
export function TopCitiesCard({ cities }: TopCitiesCardProps) {
  const { t } = useTranslation();
  const localize = useLocalizeCityName();
  const [expanded, setExpanded] = useState(false);

  const rows = expanded ? EXPANDED_ROWS : COLLAPSED_ROWS;
  const data = useMemo(
    () => cities.slice(0, rows).map((c) => ({ name: localize(c.name), count: c.count })),
    [cities, rows, localize],
  );
  const heightPx = Math.max(data.length, 4) * ROW_PX + 40;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('analytics.charts.topCities')}</CardTitle>
        {cities.length > COLLAPSED_ROWS && (
          <CardAction>
            <Button variant="ghost" size="xs" onClick={() => setExpanded((v) => !v)}>
              {expanded ? t('analytics.charts.showLess') : t('analytics.charts.showMore')}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {/* LTR keeps bars growing from the value axis consistently in Hebrew. */}
        <div className="w-full" style={{ height: heightPx }} dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} stroke="var(--border)" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={AXIS_TICK}
                stroke="var(--border)"
                width={110}
                interval={0}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} cursor={{ fill: 'var(--accent)' }} />
              <Bar
                dataKey="count"
                name={t('analytics.events')}
                fill="var(--primary)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
