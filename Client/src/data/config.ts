/**
 * Central, user-tunable runtime configuration for the Red Alerts client.
 * Values can be overridden via Vite env vars (VITE_*) where noted.
 */

export const CONFIG = {
  /**
   * An alert is considered "active" (highlighted on the map) when its
   * last_seen_at is within this many minutes of now. Change freely.
   */
  ACTIVE_ALERT_WINDOW_MINUTES: 5,

  /** The right-side feed shows events from the last N hours. */
  FEED_WINDOW_HOURS: 24,

  /** Max events requested for the recent/active query. */
  RECENT_LIMIT: 200,

  /** Max events requested for the 24h feed + analytics. */
  LAST_24H_LIMIT: 500,

  /** How often React Query refetches the recent alerts (ms). Also the polling
   *  fallback cadence when IoT realtime is not configured. */
  POLL_INTERVAL_MS: 15000,

  /** Map starting position (centered on Israel) and zoom. */
  MAP_CENTER: [34.95, 31.4] as [number, number],
  MAP_ZOOM: 7,
  MAP_MIN_ZOOM: 6,
  MAP_MAX_ZOOM: 13,
  /** Zoom level the camera flies to when focusing a single area. */
  MAP_FOCUS_ZOOM: 10,

  /** Bounding box of Israel [west, south, east, north] to constrain the map. */
  MAP_MAX_BOUNDS: [33.6, 29.0, 36.3, 33.6] as [number, number, number, number],

  /** Max number of live alerts kept in the in-memory ring buffer. */
  LIVE_BUFFER_SIZE: 100,

  /** Play a short sound when a new live alert arrives. */
  ENABLE_ALERT_SOUND: true,
} as const;
