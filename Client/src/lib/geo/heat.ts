/**
 * City "heat" coloring for the analytics map: each affected city gets a color
 * on a green -> yellow -> red ramp by how many events hit it in the selected
 * range. Counts are keyed by `cityKey` (the same normalized key the map
 * features use), and the scale is logarithmic so one hammered border town
 * doesn't wash every other city green.
 */
import { buildAlertFeatureCollection, cityKey } from '@/lib/geo';
import type { AlertEvent, CityCoords, CityFeatureCollection } from '@/types/alerts';

export interface CityHeatData {
  countsByKey: Record<string, number>;
  colorsByKey: Record<string, string>;
  max: number;
}

// Ramp endpoints (tailwind green-500 / yellow-500 / red-500).
const GREEN: [number, number, number] = [34, 197, 94];
const YELLOW: [number, number, number] = [234, 179, 8];
const RED: [number, number, number] = [239, 68, 68];

/** Same ramp as a CSS gradient — keeps the HeatLegend in sync with the map. */
export const HEAT_RAMP_GRADIENT =
  'linear-gradient(to right, rgb(34,197,94), rgb(234,179,8), rgb(239,68,68))';

function lerp(a: [number, number, number], b: [number, number, number], t: number): string {
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(channel(0))}${hex(channel(1))}${hex(channel(2))}`;
}

/** Color for a normalized intensity t in [0, 1]: green -> yellow -> red. */
export function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped <= 0.5 ? lerp(GREEN, YELLOW, clamped * 2) : lerp(YELLOW, RED, (clamped - 0.5) * 2);
}

/** Per-cityKey event counts + ramp colors for a set of events. */
export function buildHeatData(events: AlertEvent[]): CityHeatData {
  const countsByKey: Record<string, number> = {};
  for (const event of events) {
    // Sub-areas of one city ("תל אביב - מזרח", "תל אביב - מרכז העיר") share a
    // cityKey; one event should still count once for that city.
    const seen = new Set<string>();
    for (const city of event.cities) {
      const key = cityKey(city.name);
      if (seen.has(key)) continue;
      seen.add(key);
      countsByKey[key] = (countsByKey[key] ?? 0) + 1;
    }
  }

  let max = 0;
  for (const count of Object.values(countsByKey)) max = Math.max(max, count);

  const colorsByKey: Record<string, string> = {};
  const logMax = Math.log(1 + max);
  for (const [key, count] of Object.entries(countsByKey)) {
    colorsByKey[key] = heatColor(logMax > 0 ? Math.log(1 + count) / logMax : 0);
  }

  return { countsByKey, colorsByKey, max };
}

/** The analytics map's FeatureCollection: alert features colored by heat + count. */
export function buildHeatFeatureCollection(
  events: AlertEvent[],
  cityCoords: CityCoords,
  heat: CityHeatData,
): CityFeatureCollection {
  const collection = buildAlertFeatureCollection(events, cityCoords, heat.colorsByKey);
  for (const feature of collection.features) {
    feature.properties.count = heat.countsByKey[feature.properties.name] ?? 0;
  }
  return collection;
}
