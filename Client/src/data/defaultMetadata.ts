/**
 * Default page metadata. PageMetadata merges these with per-page overrides.
 */
export const DEFAULT_METADATA = {
  title: 'Red Alerts | Live alert map for Israel',
  description:
    'Red Alerts - a real-time rocket and hostile-aircraft alert map for Israel. Live alerts, an interactive map, a 24-hour event feed, and analytics.',
  keywords: 'red alerts, tzeva adom, israel, rocket alert, pikud haoref, oref, alert map',
  author: 'Red Alerts',
  image: '/og-default.png',
  robots: 'index, follow' as const,
  ogType: 'website',
} as const;

/** Base URL for canonical and og:url tags (the current origin - no env vars). */
export function getBaseUrl(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}
