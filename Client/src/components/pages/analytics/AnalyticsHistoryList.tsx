import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnalyticsHistoryItem } from '@/components/pages/analytics/AnalyticsHistoryItem';
import { cn } from '@/lib/utils';
import type { AlertEvent } from '@/types/alerts';

const FIRST_PAGE = 100;
const PAGE_STEP = 200;

interface AnalyticsHistoryListProps {
  /** Filtered window's events, newest first. */
  events: AlertEvent[];
  className?: string;
}

/** Scrollable, paginated history of the filtered events (no virtualization). */
export function AnalyticsHistoryList({ events, className }: AnalyticsHistoryListProps) {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(FIRST_PAGE);

  // New filters/window -> collapse back to the first page.
  useEffect(() => {
    setVisibleCount(FIRST_PAGE);
  }, [events]);

  const visible = events.slice(0, visibleCount);

  return (
    <Card className={cn('flex flex-col gap-3 overflow-hidden py-4', className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{t('analytics.history.title')}</CardTitle>
        <Badge variant="secondary" className="tabular-nums">
          {events.length}
        </Badge>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-3 pb-0">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 px-1 pb-3">
            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t('analytics.history.empty')}
              </p>
            ) : (
              visible.map((event) => <AnalyticsHistoryItem key={event.id} event={event} />)
            )}
            {events.length > visibleCount && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + PAGE_STEP)}
              >
                {t('analytics.history.loadMore')}
              </Button>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
