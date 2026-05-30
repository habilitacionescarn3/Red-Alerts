import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useCallback } from 'react';
import { isValidLanguage, type Language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/i18n/config';

export function useLanguage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { lng } = useParams<{ lng: string }>();

  const getCurrentLanguage = useCallback((): Language => {
    if (lng && isValidLanguage(lng)) {
      return lng;
    }
    const currentLang = i18n.language;
    if (isValidLanguage(currentLang)) {
      return currentLang;
    }
    return DEFAULT_LANGUAGE;
  }, [lng, i18n.language]);

  const changeLanguage = useCallback(
    (newLang: Language) => {
      const currentLang = getCurrentLanguage();
      if (currentLang === newLang) {
        return;
      }
      void i18n.changeLanguage(newLang);

      const pathWithoutLang = location.pathname.replace(/^\/[a-z]{2}/, '');
      const newPath = `/${newLang}${pathWithoutLang || ''}`;
      void navigate(newPath + location.search + location.hash, { replace: true });
    },
    [i18n, getCurrentLanguage, navigate, location],
  );

  return {
    language: getCurrentLanguage(),
    changeLanguage,
    availableLanguages: SUPPORTED_LANGUAGES,
    isRTL: i18n.dir() === 'rtl',
  };
}
