import { api } from '@/api/instance';
import { hydrateEvents } from '@/lib/alerts';
import type { AlertsResponse, AlertsResponseWire } from '@/types/alerts';
import type { AlertDatesResponse, RecentAlertsParams } from '@/types/alerts';

/** Join city names back onto the id-only event refs (see `hydrateEvents`). */
function hydrate(wire: AlertsResponseWire): AlertsResponse {
  return { events: hydrateEvents(wire.events, wire.cities), cities: wire.cities };
}

/** GET /api/alerts - recent events, optionally filtered by city or category. */
export async function getRecentAlerts(params: RecentAlertsParams = {}): Promise<AlertsResponse> {
  const response = await api.get<AlertsResponseWire>('/alerts', {
    limit: params.limit,
    city: params.city,
    category: params.category,
  });
  return hydrate(response.data);
}

/** GET /api/alerts/last-24h - every event from the last 24 hours. */
export async function getLast24hAlerts(limit?: number): Promise<AlertsResponse> {
  const response = await api.get<AlertsResponseWire>('/alerts/last-24h', { limit });
  return hydrate(response.data);
}

/** GET /api/alerts/:id - one event by UUID (404 when unknown), same envelope. */
export async function getAlertById(id: string): Promise<AlertsResponse> {
  const response = await api.get<AlertsResponseWire>(`/alerts/${encodeURIComponent(id)}`);
  return hydrate(response.data);
}

/** GET /api/alerts/dates - Israel-local dates in a month that have events. */
export async function getAlertDates(year: number, month: number): Promise<AlertDatesResponse> {
  const response = await api.get<AlertDatesResponse>('/alerts/dates', { year, month });
  return response.data;
}

/** GET /api/alerts/by-date - all events on an Israel-local day. */
export async function getAlertsByDate(date: string, limit?: number): Promise<AlertsResponse> {
  const response = await api.get<AlertsResponseWire>('/alerts/by-date', { date, limit });
  return hydrate(response.data);
}

/**
 * GET /api/alerts/range - all events in an inclusive Israel-local date range
 * (one parameterized URL per range so CloudFront caches it; spans cap at 31 days).
 */
export async function getAlertsRange(
  from: string,
  to: string,
  limit?: number,
): Promise<AlertsResponse> {
  // Multi-day windows over heavy days can be slow on a cold (uncached) fetch;
  // give this call more room than the global 20s default.
  const response = await api.get<AlertsResponseWire>(
    '/alerts/range',
    { from, to, limit },
    { timeout: 60000 },
  );
  return hydrate(response.data);
}
