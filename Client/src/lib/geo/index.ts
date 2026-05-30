import type { CityFeature, CityFeatureCollection } from '@/types/geo';
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

export interface ResolvedCity {
  /** Canonical dataset key (matches the polygon feature `name`). */
  key: string;
  center: [number, number];
}

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

export interface AreaMatch {
  /** Canonical dataset keys (polygon names) for matched areas. */
  matchedKeys: string[];
  /** Original Oref names with no geo match (not drawable on the map). */
  unmatched: string[];
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

export { CITY_CENTROIDS };
