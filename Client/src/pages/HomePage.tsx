import { useMemo } from 'react';
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
import { matchAreas, resolveCity } from '@/lib/geo';

function namesOf(events: { cities: { name: string }[] }[]): string[] {
  return events.flatMap((e) => e.cities.map((c) => c.name));
}

export default function HomePage() {
  const { t } = useTranslation();
  const { events, activeEvents, isLoading, isError, refetch } = useAlertEvents();
  const selectedEventId = useAlertsStore((s) => s.selectedEventId);

  const activeKeys = useMemo(() => matchAreas(namesOf(activeEvents)).matchedKeys, [activeEvents]);
  const recentKeys = useMemo(() => matchAreas(namesOf(events)).matchedKeys, [events]);
  const unmatchedActive = useMemo(() => matchAreas(namesOf(activeEvents)).unmatched, [activeEvents]);

  const selectedKey = useMemo(() => {
    if (!selectedEventId) return null;
    const event = events.find((e) => e.id === selectedEventId);
    const firstCity = event?.cities[0]?.name;
    return firstCity ? (resolveCity(firstCity)?.key ?? null) : null;
  }, [selectedEventId, events]);

  return (
    <div className="relative h-full w-full">
      <PageMetadata title={t('home.title')} />

      <AlertMap activeKeys={activeKeys} recentKeys={recentKeys} selectedKey={selectedKey} />

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
