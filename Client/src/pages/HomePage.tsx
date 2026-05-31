import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { List } from 'lucide-react';
import { PageMetadata } from '@/components/shared/PageMetadata';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertMap } from '@/components/map/AlertMap';
import { AlertFeed } from '@/components/pages/home/AlertFeed';
import { ActiveAlertsBanner } from '@/components/pages/home/ActiveAlertsBanner';
import { useAlertEvents } from '@/hooks/useAlertEvents';
import { useAlertsStore } from '@/store/alertsStore';
import { alertKeys, buildAlertFeatureCollection, cityKey, unmatchedAlertNames } from '@/lib/geo';
import { categoryMeta, SEVERITY_HEX } from '@/data/categories';
import type { MapCityMeta } from '@/components/map/AlertMap';

export default function HomePage() {
  const { t } = useTranslation();
  const { events, activeEvents, isLoading, isError, refetch } = useAlertEvents();
  const selectedEventId = useAlertsStore((s) => s.selectedEventId);
  const selectEvent = useAlertsStore((s) => s.selectEvent);

  // Pull fresh data each time the map page (re)mounts - e.g. returning from
  // Analytics - since the shared 24h query otherwise stays warm for an hour.
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build the map geometry from every event's per-city points (server-provided,
  // with a bundled-centroid fallback while a city is still being geocoded).
  const featureCollection = useMemo(() => buildAlertFeatureCollection(events), [events]);
  const activeKeys = useMemo(() => alertKeys(activeEvents), [activeEvents]);
  const recentKeys = useMemo(() => alertKeys(events), [events]);
  const unmatchedActive = useMemo(() => unmatchedAlertNames(activeEvents), [activeEvents]);

  // Per-city popup/selection info keyed by cityKey. Events are newest-first, so
  // the first one seen for a city wins (its most recent alert).
  const cityMeta = useMemo(() => {
    const map: Record<string, MapCityMeta> = {};
    for (const event of events) {
      const meta = categoryMeta(event.category?.code);
      const label = event.category?.label || t(`alerts.categories.${meta.i18nKey}`);
      const color = SEVERITY_HEX[meta.severity];
      for (const city of event.cities) {
        const key = cityKey(city.name);
        if (!map[key]) map[key] = { eventId: event.id, name: city.name, label, color };
      }
    }
    return map;
  }, [events, t]);

  // Highlight EVERY city of the selected event (the latest alert a clicked city
  // belongs to), so its whole set lights up - older events that share a city lose.
  const selectedKeys = useMemo(() => {
    if (!selectedEventId) return [];
    const event = events.find((e) => e.id === selectedEventId);
    if (!event) return [];
    return Array.from(new Set(event.cities.map((c) => cityKey(c.name))));
  }, [selectedEventId, events]);

  return (
    <div className="relative h-full w-full">
      <PageMetadata title={t('home.title')} />

      <AlertMap
        featureCollection={featureCollection}
        activeKeys={activeKeys}
        recentKeys={recentKeys}
        selectedKeys={selectedKeys}
        cityMeta={cityMeta}
        onSelectEvent={selectEvent}
      />

      <ActiveAlertsBanner activeCount={activeEvents.length} />

      {/* Docked 24h feed (desktop) */}
      <Card className="absolute end-4 top-20 bottom-4 z-20 hidden w-[360px] flex-col overflow-hidden p-0 shadow-xl md:flex">
        <AlertFeed events={events} isLoading={isLoading} isError={isError} onRetry={refetch} />
      </Card>

      {/* Mobile feed (sheet) */}
      <div className="absolute end-4 bottom-4 z-20 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="lg" className="gap-2 rounded-full shadow-xl">
              <List className="size-4" />
              {t('home.activeNow', { count: activeEvents.length })}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80svh] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{t('home.feedTitle')}</SheetTitle>
            </SheetHeader>
            <AlertFeed events={events} isLoading={isLoading} isError={isError} onRetry={refetch} />
          </SheetContent>
        </Sheet>
      </div>

      {unmatchedActive.length > 0 && (
        <div className="absolute start-4 bottom-4 z-20 max-w-xs rounded-md border bg-background/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur-md">
          {t('map.unmatched')}
        </div>
      )}
    </div>
  );
}
