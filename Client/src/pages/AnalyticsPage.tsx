import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, MapPin, ShieldAlert, TriangleAlert } from 'lucide-react';
import { PageMetadata } from '@/components/shared/PageMetadata';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Footer } from '@/components/shared/Footer';
import { AnalyticsFilterBar } from '@/components/pages/analytics/AnalyticsFilterBar';
import { AnalyticsHeatMap } from '@/components/pages/analytics/AnalyticsHeatMap';
import { AnalyticsHistoryList } from '@/components/pages/analytics/AnalyticsHistoryList';
import { EventsOverTimeCard } from '@/components/pages/analytics/EventsOverTimeCard';
import { HourOfDayCard } from '@/components/pages/analytics/HourOfDayCard';
import { StatCard } from '@/components/pages/analytics/StatCard';
import { TopCitiesCard } from '@/components/pages/analytics/TopCitiesCard';
import { TypeBreakdownCard } from '@/components/pages/analytics/TypeBreakdownCard';
import { resolveAlertType } from '@/data/alertTypes';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';
import { useAnalyticsUrlSync } from '@/hooks/useAnalyticsUrlSync';
import { cityCounts, countByAlertType, distinctCities } from '@/lib/analytics';
import { israelDateString } from '@/lib/israelTime';
import { useAnalyticsFilterStore } from '@/store/analyticsFilterStore';
import type { AlertEvent } from '@/types/alerts';

/** Apply the type and/or city filters (raw Hebrew names are the identity keys). */
function applyFilters(
  events: AlertEvent[],
  typeKeys: string[],
  cityNames: string[],
): AlertEvent[] {
  let out = events;
  if (typeKeys.length) {
    const keys = new Set(typeKeys);
    out = out.filter((e) => keys.has(resolveAlertType(e).key));
  }
  if (cityNames.length) {
    const names = new Set(cityNames);
    out = out.filter((e) => e.cities.some((c) => names.has(c.name)));
  }
  return out;
}

export default function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  useAnalyticsUrlSync();

  const { events, activeEvents, cityCoords, range, isLoading, isError, refetch } =
    useAnalyticsEvents();
  const typeKeys = useAnalyticsFilterStore((s) => s.typeKeys);
  const cityNames = useAnalyticsFilterStore((s) => s.cityNames);
  const clearFilters = useAnalyticsFilterStore((s) => s.clearFilters);

  const filteredEvents = useMemo(
    () => applyFilters(events, typeKeys, cityNames),
    [events, typeKeys, cityNames],
  );
  // Faceted filter data: each control's options reflect the OTHER filter only,
  // so making a selection never hides its own alternatives.
  const typeFiltered = useMemo(() => applyFilters(events, typeKeys, []), [events, typeKeys]);
  const cityFiltered = useMemo(() => applyFilters(events, [], cityNames), [events, cityNames]);
  const filteredActive = useMemo(
    () => applyFilters(activeEvents, typeKeys, cityNames),
    [activeEvents, typeKeys, cityNames],
  );

  const cityOptions = useMemo(() => cityCounts(typeFiltered), [typeFiltered]);
  const typeCounts = useMemo(
    () => countByAlertType(cityFiltered, i18n.language),
    [cityFiltered, i18n.language],
  );
  const filteredTypeCounts = useMemo(
    () => countByAlertType(filteredEvents, i18n.language),
    [filteredEvents, i18n.language],
  );
  const filteredCityCounts = useMemo(() => cityCounts(filteredEvents), [filteredEvents]);

  const rangeIncludesNow =
    range.mode === 'rolling24h' || range.toDate >= israelDateString();
  const topCategoryLabel = filteredTypeCounts[0]?.label ?? '—';
  const hasData = events.length > 0;
  const hasFilters = typeKeys.length > 0 || cityNames.length > 0;
  const filteredOutEverything = hasData && filteredEvents.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <PageMetadata title={`${t('analytics.title')} | Red Alerts`} canonicalPath="/analytics" />

      <div className="mx-auto w-full max-w-6xl px-3 pb-8 sm:px-4 2xl:max-w-screen-2xl">
        <header className="py-6">
          <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
            {t('analytics.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('analytics.subtitle')}</p>
        </header>

        <AnalyticsFilterBar
          typeCounts={typeCounts}
          cityOptions={cityOptions}
          foundCount={filteredEvents.length}
          isLoading={isLoading}
        />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label={
              range.mode === 'rolling24h'
                ? t('analytics.cards.total24h')
                : t('analytics.cards.totalRange')
            }
            value={filteredEvents.length}
            icon={TriangleAlert}
          />
          <StatCard
            label={t('analytics.cards.activeNow')}
            value={rangeIncludesNow ? filteredActive.length : '—'}
            icon={ShieldAlert}
            accent="destructive"
          />
          <StatCard
            label={t('analytics.cards.affectedAreas')}
            value={distinctCities(filteredEvents)}
            icon={MapPin}
          />
          <StatCard label={t('analytics.cards.topCategory')} value={topCategoryLabel} icon={Activity} />
        </div>

        {isError ? (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
              {t('analytics.loadError')}
              <Button variant="outline" size="sm" onClick={refetch}>
                {t('analytics.retry')}
              </Button>
            </CardContent>
          </Card>
        ) : !hasData ? (
          <Card className="mt-6">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              {isLoading ? '…' : t('analytics.noData')}
            </CardContent>
          </Card>
        ) : filteredOutEverything ? (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
              {t('analytics.noMatchingData')}
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  {t('analytics.filters.clear')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <EventsOverTimeCard events={filteredEvents} range={range} />
              <HourOfDayCard events={filteredEvents} />
              <TypeBreakdownCard counts={filteredTypeCounts} />
              <TopCitiesCard cities={filteredCityCounts} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
              <AnalyticsHeatMap
                events={filteredEvents}
                cityCoords={cityCoords}
                className="h-[min(60svh,420px)] lg:col-span-3 lg:h-[560px]"
              />
              <AnalyticsHistoryList
                events={filteredEvents}
                className="h-[min(70svh,480px)] lg:col-span-2 lg:h-[560px]"
              />
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
