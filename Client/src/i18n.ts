import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, updateDocumentDirection } from './i18n/config';
import { resources } from './i18n/resources';
import { app } from './data/app';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
      defaultVariables: {
        appName: app.name,
      },
    },
    resources,
  });

i18n.on('languageChanged', (lng) => {
  updateDocumentDirection(lng);
});

updateDocumentDirection(i18n.language);

export default i18n;
