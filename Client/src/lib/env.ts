/**
 * Runtime environment helpers derived purely from the current origin (no env
 * vars / secrets in the frontend).
 */

/** True when the app is served from localhost / 127.0.0.1 (local dev). */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const { origin } = window.location;
  return origin.includes('localhost') || origin.includes('127.0.0.1');
}
