import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocalizeCityName } from '@/hooks/useLocalizeCityName';
import { useAnalyticsFilterStore } from '@/store/analyticsFilterStore';
import type { CityCount } from '@/types/alerts';

/** Rows rendered at once; the search box narrows long lists past this cap. */
const MAX_VISIBLE = 120;

interface CityFilterPopoverProps {
  /** Cities of the visible window with counts, sorted desc, RAW Hebrew names. */
  options: CityCount[];
}

/**
 * Searchable multi-select over the cities present in the loaded range.
 * Selection stores RAW Hebrew names (identity keys); the localized name is
 * display-only. Search matches both forms so English users can type either.
 */
export function CityFilterPopover({ options }: CityFilterPopoverProps) {
  const { t } = useTranslation();
  const localize = useLocalizeCityName();
  const cityNames = useAnalyticsFilterStore((s) => s.cityNames);
  const toggleCity = useAnalyticsFilterStore((s) => s.toggleCity);
  const clearCities = useAnalyticsFilterStore((s) => s.clearCities);
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const selectedSet = new Set(cityNames);
    // Keep selected cities visible (and unselectable back off) even when the
    // current window no longer contains them.
    const orphanedSelected: CityCount[] = cityNames
      .filter((name) => !options.some((o) => o.name === name))
      .map((name) => ({ name, count: 0 }));
    const all = [...orphanedSelected, ...options];
    const matched = needle
      ? all.filter(
          (o) =>
            o.name.toLowerCase().includes(needle) ||
            localize(o.name).toLowerCase().includes(needle),
        )
      : all;
    const pinned = matched.filter((o) => selectedSet.has(o.name));
    const rest = matched.filter((o) => !selectedSet.has(o.name));
    return [...pinned, ...rest].slice(0, MAX_VISIBLE);
  }, [options, search, cityNames, localize]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={cityNames.length ? 'default' : 'outline'} className="gap-2">
          <MapPin className="size-4" />
          <span>{t('analytics.filters.cities')}</span>
          {cityNames.length > 0 && (
            <Badge variant="secondary" className="px-1.5 tabular-nums">
              {cityNames.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('analytics.filters.searchCities')}
            className="h-8"
          />
        </div>
        <ScrollArea className="h-64">
          <div className="p-1">
            {visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t('analytics.filters.noCityResults')}
              </p>
            ) : (
              visible.map((option) => {
                const checked = cityNames.includes(option.name);
                return (
                  <label
                    key={option.name}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleCity(option.name)}
                    />
                    <span className="min-w-0 flex-1 truncate">{localize(option.name)}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {option.count}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between border-t px-2 py-1.5">
          <span className="text-xs text-muted-foreground">
            {t('analytics.filters.selectedCount', { count: cityNames.length })}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={clearCities}
            disabled={cityNames.length === 0}
          >
            {t('analytics.filters.clear')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
