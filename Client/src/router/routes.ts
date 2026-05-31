// Path segments without leading slash or locale. Single source of truth.
// These are prefixed with /:lng in the router; use pathTo(segment, lng) for links.
export const ROUTES = {
  HOME: '',
  ANALYTICS: 'analytics',
  /** Local-only geocoding correction tool (gated behind isLocalhost()). */
  ADMIN_GEO: 'admin/geo',
} as const;

export type RouteSegment = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Build a full, locale-prefixed path. Use everywhere instead of hardcoding
 * `/${lng}/${segment}` so the URL structure lives in one place.
 */
export function pathTo(segment: string, lng: string): string {
  const trimmed = segment.replace(/^\/+/, '');
  return trimmed ? `/${lng}/${trimmed}` : `/${lng}`;
}
