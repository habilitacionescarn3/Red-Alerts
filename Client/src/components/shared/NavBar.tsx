import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, Map as MapIcon, TriangleAlert } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { ROUTES, pathTo } from '@/router/routes';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ModeToggle } from '@/components/shared/ModeToggle';
import { LiveIndicator } from '@/components/shared/LiveIndicator';

export function NavBar() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const links = [
    { to: pathTo(ROUTES.HOME, language), label: t('nav.home'), icon: MapIcon, end: true },
    { to: pathTo(ROUTES.ANALYTICS, language), label: t('nav.analytics'), icon: BarChart3, end: false },
  ];

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <NavLink to={pathTo(ROUTES.HOME, language)} className="flex items-center gap-2 font-bold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <TriangleAlert className="size-4" />
          </span>
          <span className="text-base tracking-tight">{t('nav.brand')}</span>
        </NavLink>

        <nav className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <LiveIndicator />
        <LanguageSwitcher />
        <ModeToggle />
      </div>
    </header>
  );
}
