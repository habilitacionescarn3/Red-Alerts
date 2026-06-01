import { useTranslation } from 'react-i18next';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { CONFIG } from '@/data/config';
import { cn } from '@/lib/utils';

import type { ActiveAlertsBannerProps } from '@/types/ui';

export function ActiveAlertsBanner({ activeCount }: ActiveAlertsBannerProps) {
  const { t } = useTranslation();
  const hasActive = activeCount > 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2 shadow-lg backdrop-blur-md',
          hasActive
            ? 'border-red-500/50 bg-red-500/15 text-red-600 dark:text-red-300 alert-pulse'
            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
        )}
      >
        {hasActive ? <TriangleAlert className="size-5" /> : <ShieldCheck className="size-5" />}
        <div className="text-sm font-semibold">
          {hasActive ? t('home.activeNow', { count: activeCount }) : t('home.allClear')}
        </div>
        <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
          {t('home.subtitle', { minutes: CONFIG.ACTIVE_ALERT_WINDOW_MINUTES })}
        </span>
      </div>
    </div>
  );
}
