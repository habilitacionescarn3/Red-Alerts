import { api } from '@/api/instance';
import type { LngLat } from '@/types/alerts';

/**
 * Client for the LOCAL-ONLY geocoding correction tool. These endpoints only
 * exist when the backend runs with GEO_ADMIN_ENABLED (local `make serve`), so
 * the calling UI is gated behind `isLocalhost()`.
 */

export interface AdminCity {
  id: string;
  name: string;
  coordinates: LngLat[] | null;
  created_at: string | null;
}

/** One Nominatim alternative for a place query. */
export interface GeoCandidate {
  display_name: string | null;
  type: string | null;
  category: string | null;
  point_count: number;
  points: LngLat[];
}

/** GET /api/admin/geo/cities - cities (id, name, coordinates) for the picker. */
export async function listAdminCities(q?: string): Promise<AdminCity[]> {
  const response = await api.get<AdminCity[]>('/admin/geo/cities', { q, limit: 5000 });
  return response.data;
}

/** GET /api/admin/geo/search - multiple Nominatim candidates for a free-text query. */
export async function searchLocations(q: string, limit = 10): Promise<GeoCandidate[]> {
  const response = await api.get<GeoCandidate[]>('/admin/geo/search', { q, limit });
  return response.data;
}

/** PUT /api/admin/geo/cities/:id/coordinates - overwrite a city's stored points. */
export async function saveCityCoordinates(cityId: string, points: LngLat[]): Promise<AdminCity> {
  const response = await api.put<AdminCity>(
    `/admin/geo/cities/${encodeURIComponent(cityId)}/coordinates`,
    { points },
  );
  return response.data;
}
