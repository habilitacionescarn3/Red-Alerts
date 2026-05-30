import { useTranslation } from 'react-i18next';
import { Inbox, Loader2, TriangleAlert } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { AlertFeedItem } from './AlertFeedItem';
import { useAlertsStore } from '@/store/alertsStore';
import { isActive } from '@/lib/time';
import { CONFIG } from '@/data/config';
import type { AlertEvent } from '@/types/alerts';

export interface AlertFeedProps {
  events: AlertEvent[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function AlertFeed({ events, isLoading, isError, onRetry }: AlertFeedProps) {
  const { t } = useTranslation();
  const selectedEventId = useAlertsStore((s) => s.selectedEventId);
  const requestFocus = useAlertsStore((s) => s.requestFocus);

  const handleSelect = (event: AlertEvent) => {
    const firstCity = event.cities[0]?.name;
    if (firstCity) requestFocus(firstCity, event.id);
    else useAlertsStore.getState().selectEvent(event.id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="size-4 text-primary" />
          {t('home.feedTitle')}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('home.feedSubtitle')}</p>
      </div>

      {isLoading && events.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : isError && events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <p>{t('status.error')}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t('actions.retry')}
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <Inbox className="size-6" />
          <p>{t('home.feedEmpty')}</p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2 p-3">
            {events.map((event) => (
              <AlertFeedItem
                key={event.id}
                event={event}
                isSelected={event.id === selectedEventId}
                isActive={isActive(event, CONFIG.ACTIVE_ALERT_WINDOW_MINUTES)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
