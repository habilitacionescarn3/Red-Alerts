/**
 * Single source of truth for alert-domain types.
 * Mirrors the backend contract: Server/layer/python/codebase/models/event.py
 */
import type {
  Feature as GeoFeature,
  FeatureCollection as GeoFeatureCollection,
  Geometry,
} from 'geojson';

// --- Core ---

/** A [lng, lat] coordinate pair (GeoJSON order). */
export type LngLat = [number, number];

export interface AlertCategory {
  id: string;
  code: string;
  label: string | null;
}

export interface AlertText {
  id: string;
  text: string;
}

// --- City (wire, hydrated, admin, map preview) ---

/** Hydrated city on an in-memory event. */
export interface AlertCity {
  id: string;
  name: string;
}

/** Id-only ref on the wire (name joined from response `cities`). */
export interface AlertCityRef {
  id: string;
}

/**
 * Geocoded points sent once per response. `coordinates` is null until resolved:
 * one point = marker, many points = polygon area.
 */
export interface AlertCityCoordinates {
  id: string;
  name: string;
  coordinates: LngLat[] | null;
}

/** Geo-admin city row. */
export interface AdminCity extends AlertCityCoordinates {
  created_at: string | null;
}

/** Resolved points for map preview overlays. */
export interface PreviewCity {
  id: string;
  name: string;
  points: LngLat[];
}

/** City id -> geocoded points (null until resolved). */
export type CityCoords = Map<string, LngLat[] | null>;

// --- Event, API envelope, broadcast ---

/** One logical alert episode (NOT one raw Oref id). */
export interface AlertEvent {
  id: string;
  oref_id: string;
  received_at: string | null;
  last_seen_at: string | null;
  category: AlertCategory | null;
  title: AlertText | null;
  description: AlertText | null;
  cities: AlertCity[];
}

export type AlertEventWire = Omit<AlertEvent, 'cities'> & { cities: AlertCityRef[] };

export interface AlertsResponse {
  events: AlertEvent[];
  cities: AlertCityCoordinates[];
}

export interface AlertsResponseWire {
  events: AlertEventWire[];
  cities: AlertCityCoordinates[];
}

export interface AlertBroadcast {
  status: 'created' | 'updated';
  added_cities: string[];
  event: AlertEvent;
  cities: AlertCityCoordinates[];
}

export interface AlertBroadcastWire {
  status: 'created' | 'updated';
  added_cities: string[];
  event: AlertEventWire;
  cities: AlertCityCoordinates[];
}

// --- Display metadata (values live in data/alertTypes.ts) ---

export type AlertTypeIconName =
  | 'Rocket'
  | 'Plane'
  | 'PlaneTakeoff'
  | 'Radio'
  | 'TriangleAlert'
  | 'Users'
  | 'Activity'
  | 'Ship'
  | 'FlaskConical';

export interface AlertTypeDefinition {
  key: string;
  labelEn: string;
  labelHe: string;
  color: string;
  icon: AlertTypeIconName;
}

export interface ResolvedAlertType extends AlertTypeDefinition {
  titleKey: string;
  isFallback: boolean;
}

// --- API ---

export interface RecentAlertsParams {
  limit?: number;
  city?: string;
  category?: string;
}

export interface AlertDatesResponse {
  dates: string[];
}

// --- Analytics ---

export interface HourBucket {
  ts: number;
  count: number;
}

export interface AlertTypeCount {
  key: string;
  label: string;
  count: number;
}

export interface CityCount {
  name: string;
  count: number;
}

// --- Geo / map ---

export interface CityFeatureProperties {
  name: string;
  nameEn?: string;
  center?: [number, number];
  color?: string;
  pinImage?: string;
}

export type CityFeature = GeoFeature<Geometry, CityFeatureProperties>;
export type CityFeatureCollection = GeoFeatureCollection<Geometry, CityFeatureProperties>;

export interface ResolvedCity {
  key: string;
  center: [number, number];
}

export interface AreaMatch {
  matchedKeys: string[];
  unmatched: string[];
}

export interface GeoCandidate {
  display_name: string | null;
  type: string | null;
  category: string | null;
  point_count: number;
  points: LngLat[];
}

export interface MapCityMeta {
  eventId: string;
  name: string;
  label: string;
  color: string;
}

// --- Realtime ---

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'polling' | 'offline';

export type RealtimeStatus = Extract<ConnectionStatus, 'connecting' | 'connected' | 'offline'>;

export interface IotConfig {
  region: string;
  endpoint: string;
  identityPoolId: string;
  topic: string;
}

export interface IotClientCallbacks {
  onStatus: (status: RealtimeStatus) => void;
  onBroadcast: (broadcast: AlertBroadcast) => void;
}

// --- Store ---

export interface FocusRequest {
  area: string;
  eventId: string;
  ts: number;
}

// --- Hooks ---

export interface AlertEventsResult {
  events: AlertEvent[];
  activeEvents: AlertEvent[];
  cityCoords: CityCoords;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export interface FilteredAlertEventsResult {
  feedEvents: AlertEvent[];
  mapEvents: AlertEvent[];
  activeEvents: AlertEvent[];
  cityCoords: CityCoords;
  dayEvents: AlertEvent[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
