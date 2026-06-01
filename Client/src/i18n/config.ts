// i18n configuration and language utilities.

export const SUPPORTED_LANGUAGES = ['he', 'en'] as const;
export type { Language, RouteSegment } from '@/types';
import type { Language } from '@/types';

/** RTL languages (Hebrew is the primary/default language). */
export const RTL_LANGUAGES: Language[] = ['he'];

export const DEFAULT_LANGUAGE: Language = 'he';

export const isRTL = (lng: string): boolean => RTL_LANGUAGES.includes(lng as Language);

export const isValidLanguage = (lng: string): lng is Language =>
  SUPPORTED_LANGUAGES.includes(lng as Language);

/** Resolve the best default language: URL prefix, then browser, then default. */
export const getDefaultLanguage = (): Language => {
  const path = window.location.pathname;
  const match = /^\/(he|en)(\/|$)/.exec(path);
  const pathLang = match?.[1];
  if (pathLang !== undefined && isValidLanguage(pathLang)) {
    return pathLang;
  }

  const browserLang = navigator.language.split('-')[0];
  if (browserLang !== undefined && isValidLanguage(browserLang)) {
    return browserLang;
  }

  return DEFAULT_LANGUAGE;
};

/** Sync the <html> dir/lang attributes (and an rtl/ltr class) with the language. */
export const updateDocumentDirection = (lng: string): void => {
  const htmlElement = document.documentElement;
  htmlElement.lang = lng;
  htmlElement.dir = isRTL(lng) ? 'rtl' : 'ltr';

  if (isRTL(lng)) {
    htmlElement.classList.add('rtl');
    htmlElement.classList.remove('ltr');
  } else {
    htmlElement.classList.add('ltr');
    htmlElement.classList.remove('rtl');
  }
};
