import { cityKey } from '@/lib/geo';
import { eventTime } from '@/lib/time';
import type { AlertCity, AlertEvent } from '@/types/alerts';

export type PerCityLatest = { event: AlertEvent; city: AlertCity };

/**
 * For each city touched by `events`, keep the entry from the chronologically
 * latest event. Used by the map so every city in the window is drawn once and
 * the newest episode wins for color / popup / click-through.
 */
export function resolveLatestPerCity(events: AlertEvent[]): Map<string, PerCityLatest> {
  const sorted = [...events].sort((a, b) => {
    const ta = eventTime(a)?.getTime() ?? 0;
    const tb = eventTime(b)?.getTime() ?? 0;
    return ta - tb;
  });

  const byKey = new Map<string, PerCityLatest>();
  for (const event of sorted) {
    for (const city of event.cities) {
      byKey.set(cityKey(city.name), { event, city });
    }
  }
  return byKey;
}

/** Distinct map keys for every city referenced by `events` (newest episode per key). */
export function mapCityKeys(events: AlertEvent[]): string[] {
  return Array.from(resolveLatestPerCity(events).keys());
}
