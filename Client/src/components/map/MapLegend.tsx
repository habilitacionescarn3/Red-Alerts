import { useTranslation } from 'react-i18next';

export function MapLegend() {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-none absolute start-4 top-20 z-20 hidden md:block">
      <div className="pointer-events-auto rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
        <ul className="flex flex-col gap-1.5">
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-red-500" aria-hidden />
            <span>{t('map.legendActive')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-amber-500" aria-hidden />
            <span>{t('map.legendRecent')}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
