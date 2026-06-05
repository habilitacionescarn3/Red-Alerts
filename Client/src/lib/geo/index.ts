import type {
  AlertEvent,
  AreaMatch,
  CityCoords,
  CityFeature,
  CityFeatureCollection,
  LngLat,
  ResolvedCity,
} from '@/types/alerts';
import { pinImageId } from '@/components/map/pin';
import { closedRing } from '@/lib/geo/geojson';
import { CITY_CENTROIDS } from './cityCentroids';

/**
 * Normalize a Hebrew area/city name so Oref's varied labels collapse onto the
 * canonical keys in CITY_CENTROIDS:
 *  - strip niqqud and gershayim/quotes
 *  - unify dash variants and drop the sub-area part after " - "
 *  - collapse whitespace, drop a leading "ה" only when it helps matching
 *  - smooth a couple of common spelling variants (קריית/קרית, יוד duplication)
 */
export function normalizeCityName(name: string): string {
  let value = (name || '').trim();
  value = value.replace(/[\u0591-\u05C7]/g, ''); // niqqud / cantillation
  value = value.replace(/['"׳״`]/g, ''); // quotes / gershayim
  value = value.replace(/[־–—]/g, '-'); // dash variants -> hyphen
  // Drop the Oref sub-area suffix: "תל אביב - מרכז" -> "תל אביב".
  if (value.includes(' - ')) {
    value = value.split(' - ')[0] ?? value;
  }
  value = value.replace(/-/g, ' ');
  value = value.replace(/\s+/g, ' ').trim();
  value = value.replace(/קריית/g, 'קרית');
  return value;
}

// Precomputed lookup from normalized name -> canonical dataset key.
const NORMALIZED_INDEX: Record<string, string> = (() => {
  const index: Record<string, string> = {};
  for (const key of Object.keys(CITY_CENTROIDS)) {
    index[normalizeCityName(key)] = key;
  }
  return index;
})();

/** Resolve an Oref area name to a known city (centroid + canonical key), or null. */
export function resolveCity(name: string): ResolvedCity | null {
  const normalized = normalizeCityName(name);
  let key = NORMALIZED_INDEX[normalized];

  if (!key) {
    // Partial match: dataset key contained in the (normalized) input or vice versa.
    for (const candidate of Object.keys(NORMALIZED_INDEX)) {
      if (normalized.includes(candidate) || candidate.includes(normalized)) {
        key = NORMALIZED_INDEX[candidate];
        break;
      }
    }
  }

  if (!key) return null;
  return { key, center: CITY_CENTROIDS[key] };
}

/** Build an approximate circular polygon (ring) around a centroid. */
function circlePolygon(
  center: [number, number],
  radiusKm = 3,
  points = 28,
): [number, number][] {
  const [lng, lat] = center;
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * 2 * Math.PI;
    ring.push([lng + lngDelta * Math.cos(angle), lat + latDelta * Math.sin(angle)]);
  }
  return ring;
}

let cachedCollection: CityFeatureCollection | null = null;

/**
 * GeoJSON FeatureCollection of one polygon per known city (approximate areas).
 * The map highlights subsets of these by filtering on the `name` property.
 */
export function buildCityFeatureCollection(): CityFeatureCollection {
  if (cachedCollection) return cachedCollection;

  const features: CityFeature[] = Object.entries(CITY_CENTROIDS).map(([name, center], i) => ({
    type: 'Feature',
    id: i + 1,
    properties: { name, center },
    geometry: {
      type: 'Polygon',
      coordinates: [circlePolygon(center)],
    },
  }));

  cachedCollection = { type: 'FeatureCollection', features };
  return cachedCollection;
}

/** Split a list of Oref area names into matched canonical keys and unmatched names. */
export function matchAreas(names: string[]): AreaMatch {
  const matchedKeys = new Set<string>();
  const unmatched: string[] = [];
  for (const name of names) {
    const resolved = resolveCity(name);
    if (resolved) matchedKeys.add(resolved.key);
    else unmatched.push(name);
  }
  return { matchedKeys: Array.from(matchedKeys), unmatched };
}

/**
 * Stable map key for an area: the canonical bundled key when we know the city,
 * otherwise its normalized name. Used so backend-only cities (not in the bundled
 * dataset) still highlight + draw from their server-provided points.
 */
export function cityKey(name: string): string {
  return resolveCity(name)?.key ?? normalizeCityName(name);
}

/** Distinct `cityKey`s across all cities of the given events (for highlighting). */
export function alertKeys(events: AlertEvent[]): string[] {
  const keys = new Set<string>();
  for (const event of events) {
    for (const city of event.cities) keys.add(cityKey(city.name));
  }
  return Array.from(keys);
}

/** Average of a list of points (good enough as a fly-to target). */
function centroid(points: LngLat[]): LngLat {
  const sum = points.reduce<[number, number]>(
    (acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat],
    [0, 0],
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

/** Build one map feature for a city from backend points, or the bundled fallback. */
function cityToFeature(
  id: number,
  key: string,
  points: LngLat[] | null,
  color?: string,
): CityFeature | null {
  const colorProp = color ? { color, pinImage: pinImageId(color) } : {};
  // Multiple points -> polygon area.
  if (points && points.length >= 2) {
    const ring = closedRing(points);
    return {
      type: 'Feature',
      id,
      properties: { name: key, center: centroid(points), ...colorProp },
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
  }
  // A single point -> marker.
  if (points && points.length === 1) {
    return {
      type: 'Feature',
      id,
      properties: { name: key, center: points[0], ...colorProp },
      geometry: { type: 'Point', coordinates: points[0] },
    };
  }
  // No backend points yet -> fall back to a bundled circular area, if we know it.
  const center = CITY_CENTROIDS[key];
  if (!center) return null;
  return {
    type: 'Feature',
    id,
    properties: { name: key, center, ...colorProp },
    geometry: { type: 'Polygon', coordinates: [circlePolygon(center)] },
  };
}

/** Best available geocoded points per `cityKey` across all episodes. */
function collectCoordsByCityKey(
  events: AlertEvent[],
  cityCoords: CityCoords,
): Map<string, LngLat[] | null> {
  const byKey = new Map<string, LngLat[] | null>();
  for (const event of events) {
    for (const city of event.cities) {
      const key = cityKey(city.name);
      const points = cityCoords.get(city.id) ?? null;
      const existing = byKey.get(key);
      const existingHasPoints = !!(existing && existing.length);
      if (!byKey.has(key) || (!existingHasPoints && points && points.length)) {
        byKey.set(key, points);
      }
    }
  }
  return byKey;
}

/**
 * Build the map's FeatureCollection from the events' cities + the shared
 * `cityCoords` map (city id -> points). Each distinct city (by `cityKey`)
 * becomes one feature: many points -> polygon area, a single point -> marker,
 * no points yet -> bundled circle fallback (dropped if the city isn't in the
 * bundled dataset). Every city from every event in the set is included; when
 * several episodes share a city, the newest episode drives color while coords
 * are merged from any episode that has resolved points.
 */
export function buildAlertFeatureCollection(
  events: AlertEvent[],
  cityCoords: CityCoords,
  cityColors?: Record<string, string>,
): CityFeatureCollection {
  const coordsByKey = collectCoordsByCityKey(events, cityCoords);
  const keys = new Set<string>();
  for (const event of events) {
    for (const city of event.cities) keys.add(cityKey(city.name));
  }

  const features: CityFeature[] = [];
  let id = 1;
  for (const key of keys) {
    const points = coordsByKey.get(key) ?? null;
    const feature = cityToFeature(id, key, points, cityColors?.[key]);
    if (feature) {
      features.push(feature);
      id += 1;
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Active-event city names that can't be drawn (no points and not in the dataset). */
export function unmatchedAlertNames(
  events: AlertEvent[],
  cityCoords: Map<string, LngLat[] | null>,
): string[] {
  const seen = new Set<string>();
  const unmatched: string[] = [];
  for (const event of events) {
    for (const city of event.cities) {
      const key = cityKey(city.name);
      if (seen.has(key)) continue;
      seen.add(key);
      const points = cityCoords.get(city.id);
      const hasPoints = !!(points && points.length);
      if (!hasPoints && !CITY_CENTROIDS[key]) unmatched.push(city.name);
    }
  }
  return unmatched;
}

export { CITY_CENTROIDS };
