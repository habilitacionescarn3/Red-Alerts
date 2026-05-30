import { categoryMeta } from '@/data/categories';
import { eventTime } from '@/lib/time';
import type { AlertEvent } from '@/types/alerts';

export interface HourBucket {
  /** Epoch ms at the start of the hour (for sorting / formatting). */
  ts: number;
  count: number;
}

/** Bucket events into the last 24 hourly slots, oldest -> newest. */
export function eventsPerHour(events: AlertEvent[]): HourBucket[] {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const buckets: HourBucket[] = [];
  const indexByTs = new Map<number, number>();

  for (let i = 23; i >= 0; i -= 1) {
    const ts = now.getTime() - i * 3600_000;
    indexByTs.set(ts, buckets.length);
    buckets.push({ ts, count: 0 });
  }

  for (const event of events) {
    const date = eventTime(event);
    if (!date) continue;
    const hourTs = date.getTime() - (date.getTime() % 3600_000);
    const idx = indexByTs.get(hourTs);
    if (idx !== undefined) buckets[idx].count += 1;
  }

  return buckets;
}

export interface CategoryCount {
  code: string;
  i18nKey: string;
  label: string | null;
  count: number;
}

/** Count events grouped by category, most frequent first. */
export function countByCategory(events: AlertEvent[]): CategoryCount[] {
  const map = new Map<string, CategoryCount>();
  for (const event of events) {
    const code = event.category?.code ?? 'unknown';
    const existing = map.get(code);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(code, {
        code,
        i18nKey: categoryMeta(event.category?.code).i18nKey,
        label: event.category?.label ?? null,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export interface CityCount {
  name: string;
  count: number;
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
