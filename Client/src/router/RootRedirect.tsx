import { Navigate, useLocation } from 'react-router-dom';
import { getDefaultLanguage } from '@/i18n/config';

/**
 * Redirects any path without a language prefix to the language-prefixed version
 * (e.g. "/analytics" -> "/he/analytics"), using the detected default language.
 */
export function RootRedirect() {
  const location = useLocation();
  const language = getDefaultLanguage();
  const redirectPath = `/${language}${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={redirectPath} replace />;
}
