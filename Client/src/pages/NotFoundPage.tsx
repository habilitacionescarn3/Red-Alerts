import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageMetadata } from '@/components/shared/PageMetadata';
import { useLanguage } from '@/hooks/useLanguage';
import { ROUTES, pathTo } from '@/router/routes';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <PageMetadata title={`${t('notFound.title')} | Red Alerts`} noIndex />
      <Compass className="size-12 text-muted-foreground" />
      <h1 className="text-3xl font-bold">{t('notFound.title')}</h1>
      <p className="max-w-md text-muted-foreground">{t('notFound.description')}</p>
      <Button asChild>
        <Link to={pathTo(ROUTES.HOME, language)}>{t('notFound.backHome')}</Link>
      </Button>
    </div>
  );
}
