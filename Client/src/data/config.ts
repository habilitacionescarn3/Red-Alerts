/**
 * Central, user-tunable runtime configuration for the Red Alerts client.
 * Values can be overridden via Vite env vars (VITE_*) where noted.
 */

export const CONFIG = {
  /**
   * An alert is considered "active" (highlighted on the map) when its
   * last_seen_at is within this many minutes of now. Change freely.
   */
  ACTIVE_ALERT_WINDOW_MINUTES: 10,

  /** The right-side feed shows events from the last N hours. */
  FEED_WINDOW_HOURS: 24,

  /** Max events requested for the recent/active query. */
  RECENT_LIMIT: 200,

  /** Max events requested for the 24h feed + analytics. */
  LAST_24H_LIMIT: 500,

  /** How often React Query refetches the recent alerts (ms). Also the polling
   *  fallback cadence when IoT realtime is not configured. */
  POLL_INTERVAL_MS: 15000,

  /**
   * How often the 24h feed/analytics query refetches in the background (ms).
   * Realtime (IoT) push keeps the UI live between refetches, so this is just an
   * hourly safety-net reconcile - we additionally refetch on mount (e.g. coming
   * back from Analytics) and on window focus, so the data stays fresh without
   * the old every-15s polling.
   */
  LAST_24H_REFETCH_MS: 3_600_000,

  /**
   * Map starting position and zoom. The longitude is shifted ~0.5° east of the
   * country's true centre so Israel sits further left in the viewport, away from
   * the feed card (the empty sea on the left is consumed as the country slides
   * onto it). The east bound is widened to match (see below).
   */
  MAP_CENTER: [35.45, 31.4] as [number, number],
  MAP_ZOOM: 7,
  MAP_MIN_ZOOM: 6,
  MAP_MAX_ZOOM: 13,
  /** Zoom level the camera flies to when focusing a single area. */
  MAP_FOCUS_ZOOM: 10,

  /**
   * Bounding box [west, south, east, north] constraining the map. The east edge
   * is extended (37.3) so the framing can sit further left while the west edge
   * (33.6) still keeps the full coastline in view.
   */
  MAP_MAX_BOUNDS: [33.6, 29.0, 37.3, 33.6] as [number, number, number, number],

  /** Max number of live alerts kept in the in-memory ring buffer. */
  LIVE_BUFFER_SIZE: 100,

  /** Play a short sound when a new live alert arrives. */
  ENABLE_ALERT_SOUND: true,
} as const;
