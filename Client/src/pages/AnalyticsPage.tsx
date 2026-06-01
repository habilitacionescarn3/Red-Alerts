import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, MapPin, ShieldAlert, TriangleAlert } from 'lucide-react';
import { PageMetadata } from '@/components/shared/PageMetadata';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Footer } from '@/components/shared/Footer';
import { StatCard } from '@/components/pages/analytics/StatCard';
import { useAlertEvents } from '@/hooks/useAlertEvents';
import { countByAlertType, distinctCities, eventsPerHour, topCities } from '@/lib/analytics';
import { formatClock } from '@/lib/time';

const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
};

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };

export default function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  const { events, activeEvents } = useAlertEvents();

  const perHour = useMemo(
    () =>
      eventsPerHour(events).map((b) => ({
        label: formatClock(new Date(b.ts), i18n.language),
        count: b.count,
      })),
    [events, i18n.language],
  );

  const byCategory = useMemo(
    () => countByAlertType(events, i18n.language).map((c) => ({ name: c.label, count: c.count })),
    [events, i18n.language],
  );

  const cities = useMemo(() => topCities(events, 10), [events]);

  const topCategoryLabel = byCategory[0]?.name ?? '—';
  const hasData = events.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <PageMetadata title={`${t('analytics.title')} | Red Alerts`} canonicalPath="/analytics" />

      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t('analytics.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('analytics.subtitle')}</p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t('analytics.cards.total24h')} value={events.length} icon={TriangleAlert} />
          <StatCard
            label={t('analytics.cards.activeNow')}
            value={activeEvents.length}
            icon={ShieldAlert}
            accentClassName="bg-red-500/10 text-red-500"
          />
          <StatCard
            label={t('analytics.cards.affectedAreas')}
            value={distinctCities(events)}
            icon={MapPin}
          />
          <StatCard label={t('analytics.cards.topCategory')} value={topCategoryLabel} icon={Activity} />
        </div>

        {!hasData ? (
          <Card className="mt-6">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              {t('analytics.noData')}
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t('analytics.charts.byHour')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={perHour} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="alertArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--border)" interval={2} />
                      <YAxis tick={AXIS_TICK} stroke="var(--border)" allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('analytics.charts.byCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCategory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={AXIS_TICK} stroke="var(--border)" hide />
                      <YAxis tick={AXIS_TICK} stroke="var(--border)" allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--accent)' }} />
                      <Bar dataKey="count" name={t('analytics.events')} radius={[4, 4, 0, 0]}>
                        {byCategory.map((entry, i) => (
                          <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('analytics.charts.topCities')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={cities}
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
                        width={90}
                      />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--accent)' }} />
                      <Bar dataKey="count" name={t('analytics.events')} fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
