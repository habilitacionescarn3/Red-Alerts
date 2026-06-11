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

  /** Max events requested for a multi-day analytics date range (server caps at 5000). */
  RANGE_LIMIT: 2000,

  /** Longest analytics date range, in days (mirrors the server-side cap). */
  RANGE_MAX_DAYS: 31,

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
   * Map starting position and zoom. The longitude is shifted west of the
   * country's true centre so the camera starts toward the Mediterranean (more
   * open sea on the left of the viewport, less of Jordan on the right). The whole
   * bounds window is shifted west by the same amount (see below) so the camera
   * can actually sit there without maxBounds clamping it back east.
   */
  MAP_CENTER: [35.05, 31.4] as [number, number],
  MAP_ZOOM: 7,
  MAP_MIN_ZOOM: 6,
  MAP_MAX_ZOOM: 13,
  /** Zoom level the camera flies to when focusing a single area. */
  MAP_FOCUS_ZOOM: 10,

  /**
   * Bounding box [west, south, east, north] constraining the map. The whole
   * window is shifted west (toward the sea) to match MAP_CENTER: the west edge
   * (33.2) opens up the coastline + Mediterranean, while the east edge (36.9)
   * still keeps all Israeli territory in view (and trims empty desert/Jordan).
   */
  MAP_MAX_BOUNDS: [33.2, 29.0, 36.9, 33.6] as [number, number, number, number],

  /** Max number of live alerts kept in the in-memory ring buffer. */
  LIVE_BUFFER_SIZE: 100,

  /** Play a short sound when a new live alert arrives. */
  ENABLE_ALERT_SOUND: true,
} as const;
