import { useTranslation } from 'react-i18next';
import { Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BASEMAP_IDS } from '@/components/map/mapStyle';
import { getBasemapPreviewUrl } from '@/components/map/basemapPreviews';
import { useBasemapStore } from '@/store/basemapStore';
import { cn } from '@/lib/utils';

/** Google Maps–style basemap picker with labeled thumbnail trigger. */
export function BasemapSwitcher() {
  const { t } = useTranslation();
  const basemap = useBasemapStore((s) => s.basemap);
  const setBasemap = useBasemapStore((s) => s.setBasemap);

  const currentPreview = getBasemapPreviewUrl(basemap);
  const currentLabel = t(`map.basemap.${basemap}`);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t('map.basemapLabel')}: ${currentLabel}`}
          className="pointer-events-auto flex w-[4.75rem] flex-col overflow-hidden rounded-lg border border-border bg-card text-start shadow-lg ring-1 ring-border/60 transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="relative h-12 w-full shrink-0 overflow-hidden bg-muted">
            <img
              src={currentPreview}
              alt=""
              className="size-full object-cover"
              draggable={false}
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 pb-0.5 pt-3">
              <Layers className="size-3 text-white/90" aria-hidden />
            </span>
          </div>
          <span className="truncate border-t border-border bg-card px-1.5 py-1 text-center text-[11px] font-semibold leading-tight text-foreground">
            {currentLabel}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-auto p-2">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
          {t('map.basemapLabel')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {BASEMAP_IDS.map((id) => (
            <BasemapOption
              key={id}
              label={t(`map.basemap.${id}`)}
              hint={t(`map.basemapHint.${id}`, { defaultValue: '' }) || undefined}
              previewUrl={getBasemapPreviewUrl(id)}
              selected={basemap === id}
              onSelect={() => setBasemap(id)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BasemapOption({
  label,
  hint,
  previewUrl,
  selected,
  onSelect,
}: {
  label: string;
  hint?: string;
  previewUrl: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={hint}
      className={cn(
        'flex flex-col items-center gap-1 rounded-md p-1 transition-colors hover:bg-accent',
        selected && 'bg-primary/10',
      )}
    >
      <div
        className={cn(
          'h-12 w-[4.5rem] overflow-hidden rounded-md border-2',
          selected ? 'border-primary' : 'border-transparent ring-1 ring-border',
        )}
      >
        <img
          src={previewUrl}
          alt=""
          className="size-full object-cover"
          draggable={false}
        />
      </div>
      <span
        className={cn(
          'max-w-[4.5rem] truncate text-center text-[10px] leading-tight',
          selected ? 'font-semibold text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </button>
  );
}
