import { alertDisplayLabel, resolveAlertType } from '@/data/alertTypes';
import { enumerateIsraelDays, israelDateString, israelHourOfDay } from '@/lib/israelTime';
import { eventTime, MS_PER_HOUR } from '@/lib/time';
import type { AlertEvent } from '@/types/alerts';
import type {
  AlertTypeCount,
  CityCount,
  DayBucket,
  HourBucket,
  HourOfDayBucket,
} from '@/types/alerts';

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

/** Bucket events per Israel-local day across an inclusive range (empty days kept). */
export function eventsPerDay(
  events: AlertEvent[],
  fromDate: string,
  toDate: string,
): DayBucket[] {
  const indexByDate = new Map<string, number>();
  const buckets: DayBucket[] = enumerateIsraelDays(fromDate, toDate).map((date, i) => {
    indexByDate.set(date, i);
    return { date, count: 0 };
  });

  for (const event of events) {
    const date = eventTime(event);
    if (!date) continue;
    const idx = indexByDate.get(israelDateString(date));
    if (idx !== undefined) buckets[idx].count += 1;
  }

  return buckets;
}

/** Histogram by Israel-local hour of day (24 fixed buckets, 0-23). */
export function hourOfDayHistogram(events: AlertEvent[]): HourOfDayBucket[] {
  const buckets: HourOfDayBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
  }));
  for (const event of events) {
    const date = eventTime(event);
    if (!date) continue;
    buckets[israelHourOfDay(date)].count += 1;
  }
  return buckets;
}

/** Count events grouped by alert type (title prefix), most frequent first. */
export function countByAlertType(events: AlertEvent[], language = 'en'): AlertTypeCount[] {
  const map = new Map<string, AlertTypeCount>();
  for (const event of events) {
    const resolved = resolveAlertType(event);
    // Unmapped titles all share the 'unmapped' key - bucket them per title so
    // two unknown alert types don't merge into one mislabeled bar.
    const bucketKey =
      resolved.isFallback && resolved.titleKey
        ? `unmapped:${resolved.titleKey}`
        : resolved.key;
    const existing = map.get(bucketKey);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(bucketKey, {
        key: resolved.key,
        label: alertDisplayLabel(event, language),
        color: resolved.color,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** Count events per city (an event counts once per affected city), all, sorted desc. */
export function cityCounts(events: AlertEvent[]): CityCount[] {
  const map = new Map<string, number>();
  for (const event of events) {
    for (const city of event.cities) {
      map.set(city.name, (map.get(city.name) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Count events per city (an event counts once per affected city), top N. */
export function topCities(events: AlertEvent[], limit = 10): CityCount[] {
  return cityCounts(events).slice(0, limit);
}

/** Count of distinct affected cities across all events. */
export function distinctCities(events: AlertEvent[]): number {
  const set = new Set<string>();
  for (const event of events) {
    for (const city of event.cities) set.add(city.name);
  }
  return set.size;
}
