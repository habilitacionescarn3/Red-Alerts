import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { CityFilterPopover } from '@/components/pages/analytics/CityFilterPopover';
import { RangePresetPicker } from '@/components/pages/analytics/RangePresetPicker';
import { TypeFilterChips } from '@/components/pages/analytics/TypeFilterChips';
import { useAnalyticsFilterStore } from '@/store/analyticsFilterStore';
import type { AlertTypeCount, CityCount } from '@/types/alerts';

interface AnalyticsFilterBarProps {
  /** Per-type counts for the chips (computed from city-filtered events). */
  typeCounts: AlertTypeCount[];
  /** City options for the picker (computed from type-filtered events). */
  cityOptions: CityCount[];
  /** Events matching ALL active filters. */
  foundCount: number;
  isLoading: boolean;
}

/** Sticky filter strip: range presets | type chips | city picker | found count. */
export function AnalyticsFilterBar({
  typeCounts,
  cityOptions,
  foundCount,
  isLoading,
}: AnalyticsFilterBarProps) {
  const { t } = useTranslation();
  const cityNames = useAnalyticsFilterStore((s) => s.cityNames);
  const typeKeys = useAnalyticsFilterStore((s) => s.typeKeys);
  const clearFilters = useAnalyticsFilterStore((s) => s.clearFilters);
  const hasFilters = cityNames.length > 0 || typeKeys.length > 0;

  return (
    // On phones the strip is sticky and must stay SHORT: chips collapse to one
    // horizontally-scrollable row and each group gets a compact row of its own.
    <div className="sticky top-0 z-20 -mx-3 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-4 sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
        <RangePresetPicker />
        <TypeFilterChips counts={typeCounts} />
        <CityFilterPopover options={cityOptions} />
        <div className="ms-auto flex items-center gap-2 text-sm text-muted-foreground">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <span className="whitespace-nowrap tabular-nums">
              {t('analytics.filters.found', { count: foundCount })}
            </span>
          )}
          {hasFilters && (
            <Button variant="ghost" size="xs" onClick={clearFilters}>
              {t('analytics.filters.clear')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
