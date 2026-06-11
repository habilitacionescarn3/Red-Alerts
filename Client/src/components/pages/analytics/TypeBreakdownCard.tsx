import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AXIS_TICK,
  CHART_MARGIN,
  PALETTE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_STYLE,
  Y_AXIS_WIDTH,
} from '@/components/pages/analytics/chartTheme';
import type { AlertTypeCount } from '@/types/alerts';

interface TypeBreakdownCardProps {
  /** Localized + colored per-type counts of the filtered window. */
  counts: AlertTypeCount[];
}

interface TypeTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}

/** Greedy word-wrap so type names stay within their (narrow) column. */
function wrapLabel(value: string, maxChars = 10): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(' ')) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** Axis tick that wraps long type names onto short lines under the column. */
function TypeTick({ x = 0, y = 0, payload }: TypeTickProps) {
  const lines = wrapLabel(String(payload?.value ?? ''));
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="var(--muted-foreground)" fontSize={10}>
        {lines.map((line, i) => (
          <tspan key={line} x={0} dy={i === 0 ? 10 : 11}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** Events per alert type, colored with each type's real color. */
export function TypeBreakdownCard({ counts }: TypeBreakdownCardProps) {
  const { t } = useTranslation();
  const data = counts.map((c) => ({ name: c.label, count: c.count, color: c.color }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('analytics.charts.byCategory')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Keep the categorical axis LTR too — wrapped Hebrew tick labels still
            render RTL text correctly inside the isolated SVG. */}
        <div className="h-60 w-full sm:h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ ...CHART_MARGIN, top: 16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={<TypeTick />}
                interval={0}
                height={44}
                stroke="var(--border)"
              />
              <YAxis
                tick={AXIS_TICK}
                stroke="var(--border)"
                allowDecimals={false}
                width={Y_AXIS_WIDTH}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={{ fill: 'var(--accent)' }}
              />
              <Bar dataKey="count" name={t('analytics.events')} radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  fill="var(--muted-foreground)"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
