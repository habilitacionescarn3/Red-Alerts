import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect, type ComponentProps } from 'react';

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

const THEME_STORAGE_KEY = 'red-alerts-theme';
/** Bump when a one-time theme reset should apply to all returning visitors. */
const THEME_RESET_VERSION = 'v2';

/** One-time: default everyone to dark (drops legacy system/light defaults). */
function migrateStoredTheme(): void {
  try {
    const resetKey = `${THEME_STORAGE_KEY}-reset-${THEME_RESET_VERSION}`;
    if (localStorage.getItem(resetKey)) return;
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    localStorage.setItem(resetKey, '1');
  } catch {
    // localStorage unavailable (SSR / privacy mode) — ignore
  }
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    migrateStoredTheme();
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
