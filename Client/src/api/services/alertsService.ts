import { api } from '@/api/instance';
import { hydrateEvents } from '@/lib/alerts';
import type { AlertsResponse, AlertsResponseWire } from '@/types/alerts';

export interface RecentAlertsParams {
  limit?: number;
  city?: string;
  category?: string;
}

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
