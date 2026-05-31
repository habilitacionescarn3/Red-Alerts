/**
 * Display metadata for Oref alert categories (the `cat` code).
 * The human-readable label still comes from the event itself (category.label /
 * title); this only drives the icon + severity color used across the UI.
 */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info';

export interface CategoryMeta {
  /** lucide-react icon name (resolved in components/shared/CategoryIcon). */
  icon: string;
  severity: AlertSeverity;
  /** i18n key under `alerts.categories.*` for a fallback label. */
  i18nKey: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  '1': { icon: 'Rocket', severity: 'critical', i18nKey: 'missiles' },
  '2': { icon: 'TriangleAlert', severity: 'high', i18nKey: 'general' },
  '3': { icon: 'Radio', severity: 'medium', i18nKey: 'earlyWarning' },
  '4': { icon: 'Plane', severity: 'high', i18nKey: 'hostileAircraft' },
  '5': { icon: 'FlaskConical', severity: 'high', i18nKey: 'hazardousMaterials' },
  '6': { icon: 'Users', severity: 'critical', i18nKey: 'terroristInfiltration' },
  '7': { icon: 'Activity', severity: 'high', i18nKey: 'earthquake' },
  '13': { icon: 'Ship', severity: 'high', i18nKey: 'hostileVessel' },
};

const DEFAULT_META: CategoryMeta = {
  icon: 'TriangleAlert',
  severity: 'high',
  i18nKey: 'general',
};

export function categoryMeta(code: string | null | undefined): CategoryMeta {
  if (!code) return DEFAULT_META;
  return CATEGORY_META[code] ?? DEFAULT_META;
}

/** Tailwind text/border/bg classes per severity (used for badges, feed accents). */
export const SEVERITY_CLASSES: Record<AlertSeverity, string> = {
  critical: 'text-red-600 dark:text-red-400 border-red-500/40 bg-red-500/10',
  high: 'text-orange-600 dark:text-orange-400 border-orange-500/40 bg-orange-500/10',
  medium: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
  info: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
};

/** Raw hex per severity, for non-Tailwind contexts (e.g. the map popup DOM). */
export const SEVERITY_HEX: Record<AlertSeverity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  info: '#0ea5e9',
};
