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

/** In-memory city ref. The `name` is hydrated client-side from `cities` (the
 *  wire only carries `id` per event - the name lives once in the response). */
export interface AlertCity {
  id: string;
  name: string;
}

/** Per-event city ref as sent on the wire: id only (name joined from `cities`). */
export interface AlertCityRef {
  id: string;
}

/** A [lng, lat] coordinate pair (GeoJSON order). */
export type LngLat = [number, number];

/**
 * Geocoded points for one city, sent ONCE at the response level (not inlined
 * per event, to avoid duplicating large polygon rings). `coordinates` is null
 * until the backend resolves it, then an array of [lng, lat]: a single point is
 * a map marker, multiple points form a polygon area.
 */
export interface AlertCityCoordinates {
  id: string;
  name: string;
  coordinates: LngLat[] | null;
}

/** One logical alert episode (NOT one raw Oref id). In-memory shape: cities are
 *  hydrated with names (see `hydrateEvents`). */
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
}

/** Wire shape of an event: identical to `AlertEvent` but cities are id-only. */
export type AlertEventWire = Omit<AlertEvent, 'cities'> & { cities: AlertCityRef[] };

/**
 * Envelope as RECEIVED from every event endpoint: events reference cities by id,
 * and each distinct city's name + points are carried once in `cities`.
 * Source of truth: Server/layer/python/codebase/controllers/events_controller.py.
 */
export interface AlertsResponseWire {
  events: AlertEventWire[];
  cities: AlertCityCoordinates[];
}

/** Same envelope after hydration: event cities carry their names again. */
export interface AlertsResponse {
  events: AlertEvent[];
  cities: AlertCityCoordinates[];
}

/** Broadcast as received on the IoT topic (event cities are id-only). */
export interface AlertBroadcastWire {
  status: 'created' | 'updated';
  added_cities: string[];
  event: AlertEventWire;
  cities: AlertCityCoordinates[];
}

/**
 * Broadcast after hydration (event cities carry names). Mirrors the API envelope
 * so the client parses REST and realtime the same way.
 */
export interface AlertBroadcast {
  status: 'created' | 'updated';
  added_cities: string[];
  event: AlertEvent;
  cities: AlertCityCoordinates[];
}
