import { api } from '@/api/instance';
import type { AdminCity, GeoCandidate, LngLat } from '@/types/alerts';

/**
 * Client for the LOCAL-ONLY geocoding correction tool. These endpoints only
 * exist when the backend runs with GEO_ADMIN_ENABLED (local `make serve`), so
 * the calling UI is gated behind `isLocalhost()`.
 */
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
