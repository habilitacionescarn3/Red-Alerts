import type { LngLat } from '@/types/alerts';

/** Close a ring (first === last) so it forms a valid GeoJSON polygon. */
export function closedRing(points: LngLat[]): LngLat[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

/** A polygon (>=2 points) or point (1 point) geometry, or null when empty. */
export function pointsToGeometry(points: LngLat[]): GeoJSON.Geometry | null {
  if (points.length >= 2) {
    return { type: 'Polygon', coordinates: [closedRing(points)] };
  }
  if (points.length === 1) {
    return { type: 'Point', coordinates: points[0] };
  }
  return null;
}
