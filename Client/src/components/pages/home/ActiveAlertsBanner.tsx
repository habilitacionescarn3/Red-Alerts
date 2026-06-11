import { useTranslation } from 'react-i18next';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { CONFIG } from '@/data/config';
import { cn } from '@/lib/utils';

import type { ActiveAlertsBannerProps } from '@/types/ui';

export function ActiveAlertsBanner({ activeCount }: ActiveAlertsBannerProps) {
  const { t } = useTranslation();
  const hasActive = activeCount > 0;

  return (
    // md+: below that the mobile active-alerts pill carries the same state.
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 hidden justify-center px-3 sm:top-4 sm:px-4 md:flex">
      <div
        className={cn(
          'pointer-events-auto flex max-w-[min(100%,36rem)] flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border px-3 py-1.5 shadow-lg backdrop-blur-md sm:gap-3 sm:px-4 sm:py-2',
          hasActive
            ? 'border-destructive/50 bg-destructive/15 text-destructive alert-pulse'
            : 'border-success/40 bg-success/10 text-success',
        )}
      >
        {hasActive ? <TriangleAlert className="size-4 shrink-0 sm:size-5" /> : <ShieldCheck className="size-4 shrink-0 sm:size-5" />}
        <div className="text-center text-xs font-semibold sm:text-sm">
          {hasActive ? t('home.activeNow', { count: activeCount }) : t('home.allClear')}
        </div>
        <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
          {hasActive
            ? t('home.subtitle', { minutes: CONFIG.ACTIVE_ALERT_WINDOW_MINUTES })
            : t('home.subtitleClear', { minutes: CONFIG.ACTIVE_ALERT_WINDOW_MINUTES })}
        </span>
      </div>
    </div>
  );
}
