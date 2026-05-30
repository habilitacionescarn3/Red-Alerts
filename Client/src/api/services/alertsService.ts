import { api } from '@/api/instance';
import type { AlertEvent } from '@/types/alerts';

export interface RecentAlertsParams {
  limit?: number;
  city?: string;
  category?: string;
}

/** GET /api/alerts - recent events, optionally filtered by city or category. */
export async function getRecentAlerts(params: RecentAlertsParams = {}): Promise<AlertEvent[]> {
  const response = await api.get<AlertEvent[]>('/alerts', {
    limit: params.limit,
    city: params.city,
    category: params.category,
  });
  return response.data;
}

/** GET /api/alerts/last-24h - every event from the last 24 hours. */
export async function getLast24hAlerts(limit?: number): Promise<AlertEvent[]> {
  const response = await api.get<AlertEvent[]>('/alerts/last-24h', { limit });
  return response.data;
}
