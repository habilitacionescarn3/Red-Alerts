import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, List } from 'lucide-react';
import { PageMetadata } from '@/components/shared/PageMetadata';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertMap } from '@/components/map/AlertMap';
import { BasemapSwitcher } from '@/components/map/BasemapSwitcher';
import { AlertFeed } from '@/components/pages/home/AlertFeed';
import { ActiveAlertsBanner } from '@/components/pages/home/ActiveAlertsBanner';
import { TimelineBar } from '@/components/pages/home/timeline/TimelineBar';
import { CONFIG } from '@/data/config';
import { useFilteredAlertEvents } from '@/hooks/useFilteredAlertEvents';
import { useMapOverlayBottomInset } from '@/hooks/useMapOverlayBottomInset';
import { useTimelineUrlSync } from '@/hooks/useTimelineUrlSync';
import { cn } from '@/lib/utils';
import { mapCityKeys } from '@/lib/map/perCity';
import { buildAlertFeatureCollection, cityKey, unmatchedAlertNames } from '@/lib/geo';
import { buildCityMeta } from '@/lib/map/cityMeta';
import { useAlertsStore } from '@/store/alertsStore';
import { useTimelineStore } from '@/store/timelineStore';

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const {
    feedEvents,
    mapEvents,
    activeEvents,
    cityCoords,
    dayEvents,
    isLoading,
    isError,
    refetch,
  } = useFilteredAlertEvents();
  const selectedEventId = useAlertsStore((s) => s.selectedEventId);
  const selectEvent = useAlertsStore((s) => s.selectEvent);
  const hasCustomRange = useTimelineStore((s) => s.hasCustomRange);
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const bottomInsetPx = useMapOverlayBottomInset();
  const timelineOpen = useTimelineStore((s) => s.isOpen);
  const openTimeline = useTimelineStore((s) => s.openTimeline);

  useTimelineUrlSync();

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const feedCopy = useMemo(() => {
    if (!hasCustomRange) {
      return {
        feedTitle: t('home.feedTitle24h'),
        feedSubtitle: t('home.feedSubtitleDefault', {
          minutes: CONFIG.ACTIVE_ALERT_WINDOW_MINUTES,
        }),
        feedEmpty: t('home.feedEmpty24h'),
      };
    }
    return {
      feedTitle: t('home.feedTitleDay', { date: selectedDate }),
      feedSubtitle: t('home.feedSubtitleDay'),
      feedEmpty: t('home.feedEmptyDay'),
    };
  }, [hasCustomRange, selectedDate, t]);

  /** Feed selection can point at an event outside the default 5-min map window. */
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return (
      feedEvents.find((e) => e.id === selectedEventId) ??
      mapEvents.find((e) => e.id === selectedEventId) ??
      null
    );
  }, [selectedEventId, feedEvents, mapEvents]);

  const displayMapEvents = useMemo(() => {
    if (!selectedEvent || mapEvents.some((e) => e.id === selectedEvent.id)) return mapEvents;
    return [...mapEvents, selectedEvent];
  }, [mapEvents, selectedEvent]);

  const cityMeta = useMemo(
    () => buildCityMeta(displayMapEvents, i18n.language),
    [displayMapEvents, i18n.language],
  );

  const featureCollection = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const [key, meta] of Object.entries(cityMeta)) colors[key] = meta.color;
    return buildAlertFeatureCollection(displayMapEvents, cityCoords, colors);
  }, [displayMapEvents, cityCoords, cityMeta]);

  const activeKeys = useMemo(() => mapCityKeys(activeEvents), [activeEvents]);
  const recentKeys = useMemo(() => mapCityKeys(mapEvents), [mapEvents]);
  const selectedKeys = useMemo(() => {
    if (!selectedEvent) return [];
    return Array.from(new Set(selectedEvent.cities.map((c) => cityKey(c.name))));
  }, [selectedEvent]);
  /** Draw feed-selected cities even when outside the live map window. */
  const displayRecentKeys = useMemo(() => {
    const keys = new Set(recentKeys);
    for (const key of selectedKeys) keys.add(key);
    return Array.from(keys);
  }, [recentKeys, selectedKeys]);

  const unmatchedActive = useMemo(
    () => unmatchedAlertNames(activeEvents, cityCoords),
    [activeEvents, cityCoords],
  );

  const feedProps = {
    events: feedEvents,
    isLoading,
    isError,
    onRetry: refetch,
    ...feedCopy,
  };

  const overlayBottom = `${bottomInsetPx}px`;
  // Nudge the basemap picker up when a city/event is selected so the
  // MapLibre popup near the bottom of the map isn't hidden behind it.
  const basemapBottom = selectedEventId
    ? `${bottomInsetPx + 56}px`
    : overlayBottom;

  return (
    <div className="relative h-full w-full">
      <PageMetadata title={t('home.title')} />

      <AlertMap
        featureCollection={featureCollection}
        activeKeys={activeKeys}
        recentKeys={displayRecentKeys}
        selectedKeys={selectedKeys}
        cityMeta={cityMeta}
        onSelectEvent={selectEvent}
      />

      <ActiveAlertsBanner activeCount={activeEvents.length} />

      <Card
        className="absolute end-3 top-20 z-20 hidden w-[clamp(320px,26vw,460px)] flex-col gap-0 overflow-hidden py-0 shadow-xl sm:end-4 2xl:w-[clamp(360px,22vw,520px)] md:flex"
        style={{ bottom: overlayBottom }}
      >
        <AlertFeed {...feedProps} />
      </Card>

      {/* Mobile controls (md:hidden): history (left) + active alerts (right) sit
          on the bottom row; the layers picker sits above history on the left,
          and the map attribution is lifted to the matching spot on the right
          (see the mobile rule in index.css). When the timeline opens, history is
          replaced by the panel and the remaining controls float just above it. */}
      <div
        className="pointer-events-none absolute inset-x-0 z-20 flex items-end justify-between px-3 md:hidden transition-[bottom] duration-200"
        style={{ bottom: timelineOpen ? overlayBottom : selectedEventId ? '3.5rem' : '1rem' }}
      >
        <div className="flex flex-col items-start gap-2">
          <BasemapSwitcher />
          {!timelineOpen && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="pointer-events-auto gap-2 rounded-full bg-background/90 shadow-xl backdrop-blur-md hover:bg-accent"
              onClick={openTimeline}
            >
              <Clock className="size-4" />
              {t('timeline.open')}
            </Button>
          )}
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className={cn(
                'pointer-events-auto gap-2 rounded-full shadow-xl',
                activeEvents.length === 0 &&
                  'bg-emerald-600 text-white hover:bg-emerald-700',
              )}
            >
              <List className="size-4" />
              {t('home.activeNow', { count: activeEvents.length })}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80svh] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{feedCopy.feedTitle}</SheetTitle>
            </SheetHeader>
            <AlertFeed {...feedProps} />
          </SheetContent>
        </Sheet>
      </div>

      {unmatchedActive.length > 0 && (
        <div
          className="absolute start-3 z-20 max-w-[min(100%,18rem)] rounded-md border bg-background/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur-md sm:start-4 sm:max-w-xs"
          style={{ bottom: overlayBottom }}
        >
          {t('map.unmatched')}
        </div>
      )}

      {/* Desktop basemap picker — bottom-start corner. Mobile uses the cluster above. */}
      <div
        className="pointer-events-none absolute start-3 z-20 hidden sm:start-4 md:block transition-[bottom] duration-200"
        style={{ bottom: basemapBottom }}
      >
        <BasemapSwitcher />
      </div>

      <TimelineBar dayEvents={dayEvents} />
    </div>
  );
}
