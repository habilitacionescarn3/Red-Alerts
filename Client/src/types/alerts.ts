/**
 * Frontend mirror of the backend `Event.to_dict()` contract.
 * Source of truth: Server/layer/python/codebase/models/event.py.
 */

export interface AlertCategory {
  id: string;
  code: string;
  label: string | null;
}

export interface AlertText {
  id: string;
  text: string;
}

export interface AlertCity {
  id: string;
  name: string;
}

/** A [lng, lat] coordinate pair (GeoJSON order). */
export type LngLat = [number, number];

/**
 * Geocoded points for one city in an event.
 * `points` is null until the backend resolves it, then an array of [lng, lat]:
 * a single point is a map marker, multiple points form a polygon area.
 */
export interface AlertCoordinate {
  id: string;
  name: string;
  points: LngLat[] | null;
}

/** One logical alert episode (NOT one raw Oref id). */
export interface AlertEvent {
  id: string;
  oref_id: string;
  /** ISO-8601 UTC string for when the episode started. */
  received_at: string | null;
  /** ISO-8601 UTC string for the last update absorbed into the episode. */
  last_seen_at: string | null;
  category: AlertCategory | null;
  title: AlertText | null;
  description: AlertText | null;
  cities: AlertCity[];
  /** Distinct per-city points for the map (one entry per city, deduped). */
  coordinates: AlertCoordinate[];
}

/**
 * Payload broadcast on the IoT topic by the worker.
 * Source of truth: Server/layer/python/codebase/controllers/events_controller.py.
 */
export interface AlertBroadcast {
  status: 'created' | 'updated';
  added_cities: string[];
  event: AlertEvent;
}
