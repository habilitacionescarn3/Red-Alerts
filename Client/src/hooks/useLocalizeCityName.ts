import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getCityNamesVersion,
  localizeCityName,
  preloadCityNames,
  subscribeCityNames,
} from '@/lib/geo/cityNames';

/**
 * Render-time localizer for Oref city/area names. Returns the name unchanged
 * in Hebrew mode; in English mode resolves it through the bundled Oref
 * dictionary (lazy-loaded — subscribers re-render when it arrives).
 * Display-only: never feed the result back into cityKey()/store/filter keys.
 */
export function useLocalizeCityName(): (name: string) => string {
  const { i18n } = useTranslation();
  const version = useSyncExternalStore(subscribeCityNames, getCityNamesVersion);

  useEffect(() => {
    if (i18n.language.startsWith('en')) void preloadCityNames();
  }, [i18n.language]);

  return useMemo(() => {
    void version; // dictionary arrival must invalidate the memoized localizer
    return (name: string) => localizeCityName(name, i18n.language);
  }, [i18n.language, version]);
}
