import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LanguageLayout } from '@/router/LanguageLayout';
import { RootRedirect } from '@/router/RootRedirect';
import { AppLayout } from '@/components/layouts/AppLayout';
import { ROUTES } from '@/router/routes';

const HomePage = lazy(() => import('@/pages/HomePage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/:lng" element={<LanguageLayout />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path={ROUTES.ANALYTICS} element={<AnalyticsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  );
}
