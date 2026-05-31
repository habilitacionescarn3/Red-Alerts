import type {
  AlertCityCoordinates,
  AlertEvent,
  AlertEventWire,
} from '@/types/alerts';

/**
 * Re-attach city names to events. The wire sends each event's cities as id-only
 * (`{id}`); the name lives once in the response-level `cities` array. Hydrating
 * here keeps the in-memory `AlertEvent` convenient (cities carry `{id, name}`)
 * so the rest of the UI is unaffected by the leaner wire format.
 */
export function hydrateEvents(
  events: AlertEventWire[],
  cities: AlertCityCoordinates[],
): AlertEvent[] {
  const names = new Map(cities.map((c) => [c.id, c.name]));
  return events.map((event) => ({
    ...event,
    cities: event.cities.map((c) => ({ id: c.id, name: names.get(c.id) ?? '' })),
  }));
}

/** Single-event convenience wrapper around {@link hydrateEvents}. */
export function hydrateEvent(
  event: AlertEventWire,
  cities: AlertCityCoordinates[],
): AlertEvent {
  return hydrateEvents([event], cities)[0];
}
