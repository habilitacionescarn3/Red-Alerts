import { CONFIG } from '@/data/config';
import { eventTime, isActive, MS_PER_MINUTE, parseEventDate } from '@/lib/time';
import type {
  AlertCityCoordinates,
  AlertEvent,
  CityCoords,
  LngLat,
} from '@/types/alerts';

/** True when an episode's [received_at, last_seen_at] window intersects the range. */
export function eventOverlapsRange(
  event: AlertEvent,
  startMs: number,
  endMs: number,
): boolean {
  const episodeStart = parseEventDate(event.received_at)?.getTime();
  const episodeEnd = eventTime(event)?.getTime();
  if (
    episodeStart === undefined ||
    episodeStart === null ||
    Number.isNaN(episodeStart) ||
    episodeEnd === undefined ||
    episodeEnd === null ||
    Number.isNaN(episodeEnd)
  ) {
    return false;
  }
  return episodeStart <= endMs && episodeEnd >= startMs;
}

export function mergeAlertEvents(
  serverEvents: AlertEvent[],
  liveEvents: AlertEvent[],
  includeLive: boolean,
): AlertEvent[] {
  const byId = new Map<string, AlertEvent>();
  for (const event of serverEvents) byId.set(event.id, event);
  if (includeLive) {
    for (const event of liveEvents) byId.set(event.id, event);
  }
  return sortEventsByTime(Array.from(byId.values()));
}

export function sortEventsByTime(events: AlertEvent[]): AlertEvent[] {
  return [...events].sort((a, b) => {
    const ta = eventTime(a)?.getTime() ?? 0;
    const tb = eventTime(b)?.getTime() ?? 0;
    return tb - ta;
  });
}

export function buildCityCoordsMap(
  cityLists: AlertCityCoordinates[][],
  liveCityCoords: Record<string, LngLat[] | null>,
): CityCoords {
  const map: CityCoords = new Map();
  for (const cities of cityLists) {
    for (const city of cities) map.set(city.id, city.coordinates);
  }
  for (const [id, points] of Object.entries(liveCityCoords)) map.set(id, points);
  return map;
}

export function filterEventsByRange(
  events: AlertEvent[],
  startMs: number,
  endMs: number,
): AlertEvent[] {
  return events.filter((event) => eventOverlapsRange(event, startMs, endMs));
}

export function filterEventsLastMinutes(
  events: AlertEvent[],
  minutes: number,
  nowMs: number,
): AlertEvent[] {
  const cutoff = nowMs - minutes * MS_PER_MINUTE;
  return events.filter((event) => {
    const t = eventTime(event)?.getTime();
    return t !== undefined && t !== null && !Number.isNaN(t) && t >= cutoff;
  });
}

export function filterActiveEvents(events: AlertEvent[]): AlertEvent[] {
  return events.filter((e) => isActive(e, CONFIG.ACTIVE_ALERT_WINDOW_MINUTES));
}
