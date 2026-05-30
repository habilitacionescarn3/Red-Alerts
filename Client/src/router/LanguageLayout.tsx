import { useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isValidLanguage, getDefaultLanguage } from '@/i18n/config';

/**
 * Wraps every route: reads :lng from the URL, syncs i18n, and redirects
 * missing/invalid languages to the default while preserving the rest of the path.
 */
export function LanguageLayout() {
  const { lng } = useParams<{ lng: string }>();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!lng || !isValidLanguage(lng)) {
      const defaultLang = getDefaultLanguage();
      void navigate(`/${defaultLang}${location.pathname}${location.search}${location.hash}`, {
        replace: true,
      });
      return;
    }

    if (i18n.language !== lng) {
      void i18n.changeLanguage(lng);
    }
  }, [lng, i18n, navigate, location]);

  return <Outlet />;
}
