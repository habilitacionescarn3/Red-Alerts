import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { List } from 'lucide-react';
import { PageMetadata } from '@/components/shared/PageMetadata';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertMap } from '@/components/map/AlertMap';
import { MapLegend } from '@/components/map/MapLegend';
import { AlertFeed } from '@/components/pages/home/AlertFeed';
import { ActiveAlertsBanner } from '@/components/pages/home/ActiveAlertsBanner';
import { TimelineBar } from '@/components/pages/home/timeline/TimelineBar';
import { CONFIG } from '@/data/config';
import { useFilteredAlertEvents } from '@/hooks/useFilteredAlertEvents';
import { useTimelineUrlSync } from '@/hooks/useTimelineUrlSync';
import { alertKeys, buildAlertFeatureCollection, cityKey, unmatchedAlertNames } from '@/lib/geo';
import { buildCityMeta } from '@/lib/map/cityMeta';
import { useAlertsStore } from '@/store/alertsStore';
import { useTimelineStore } from '@/store/timelineStore';

/** Bottom timeline bar height + padding (keep feed card above it). */
const TIMELINE_OFFSET_OPEN = '7.5rem';
const TIMELINE_OFFSET_CLOSED = '1rem';

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
  const isTimelineOpen = useTimelineStore((s) => s.isOpen);

  useTimelineUrlSync();

  const timelineOffset = isTimelineOpen ? TIMELINE_OFFSET_OPEN : TIMELINE_OFFSET_CLOSED;

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
    () => buildCityMeta(displayMapEvents, selectedEvent, i18n.language),
    [displayMapEvents, i18n.language, selectedEvent],
  );

  const featureCollection = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const [key, meta] of Object.entries(cityMeta)) colors[key] = meta.color;
    return buildAlertFeatureCollection(displayMapEvents, cityCoords, colors);
  }, [displayMapEvents, cityCoords, cityMeta]);

  const activeKeys = useMemo(() => alertKeys(activeEvents), [activeEvents]);
  const recentKeys = useMemo(() => alertKeys(mapEvents), [mapEvents]);
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

      <MapLegend />
      <ActiveAlertsBanner activeCount={activeEvents.length} />

      <Card
        className="absolute end-4 top-20 z-20 hidden w-[360px] flex-col gap-0 overflow-hidden py-0 shadow-xl md:flex"
        style={{ bottom: timelineOffset }}
      >
        <AlertFeed {...feedProps} />
      </Card>

      <div className="absolute end-4 z-20 md:hidden" style={{ bottom: timelineOffset }}>
        <Sheet>
          <SheetTrigger asChild>
            <Button size="lg" className="gap-2 rounded-full shadow-xl">
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
          className="absolute start-4 z-20 max-w-xs rounded-md border bg-background/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur-md"
          style={{ bottom: timelineOffset }}
        >
          {t('map.unmatched')}
        </div>
      )}

      <TimelineBar dayEvents={dayEvents} />
    </div>
  );
}
