import { alertDisplayLabel, resolveAlertType } from '@/data/alertTypes';
import { eventTime, MS_PER_HOUR } from '@/lib/time';
import type { AlertEvent } from '@/types/alerts';
import type { AlertTypeCount, CityCount, HourBucket } from '@/types/alerts';

/** Bucket events into the last 24 hourly slots, oldest -> newest. */
export function eventsPerHour(events: AlertEvent[]): HourBucket[] {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const buckets: HourBucket[] = [];
  const indexByTs = new Map<number, number>();

  for (let i = 23; i >= 0; i -= 1) {
    const ts = now.getTime() - i * MS_PER_HOUR;
    indexByTs.set(ts, buckets.length);
    buckets.push({ ts, count: 0 });
  }

  for (const event of events) {
    const date = eventTime(event);
    if (!date) continue;
    const hourTs = date.getTime() - (date.getTime() % MS_PER_HOUR);
    const idx = indexByTs.get(hourTs);
    if (idx !== undefined) buckets[idx].count += 1;
  }

  return buckets;
}

/** Count events grouped by alert type (title prefix), most frequent first. */
export function countByAlertType(events: AlertEvent[], language = 'en'): AlertTypeCount[] {
  const map = new Map<string, AlertTypeCount>();
  for (const event of events) {
    const { key } = resolveAlertType(event);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        key,
        label: alertDisplayLabel(event, language),
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** Count events per city (an event counts once per affected city), top N. */
export function topCities(events: AlertEvent[], limit = 10): CityCount[] {
  const map = new Map<string, number>();
  for (const event of events) {
    for (const city of event.cities) {
      map.set(city.name, (map.get(city.name) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Count of distinct affected cities across all events. */
export function distinctCities(events: AlertEvent[]): number {
  const set = new Set<string>();
  for (const event of events) {
    for (const city of event.cities) set.add(city.name);
  }
  return set.size;
}
