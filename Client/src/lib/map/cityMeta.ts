import { alertDisplayLabel, resolveAlertType } from '@/data/alertTypes';
import { resolveLatestPerCity } from '@/lib/map/perCity';
import type { AlertEvent } from '@/types/alerts';
import type { MapCityMeta } from '@/types/alerts';

/**
 * Build per-city popup metadata for the map. The chronologically latest event
 * per city wins for color, label, and click-through.
 */
export function buildCityMeta(
  events: AlertEvent[],
  language: string,
): Record<string, MapCityMeta> {
  const map: Record<string, MapCityMeta> = {};
  for (const [key, { event, city }] of resolveLatestPerCity(events)) {
    const alertType = resolveAlertType(event);
    map[key] = {
      eventId: event.id,
      name: city.name,
      label: alertDisplayLabel(event, language),
      color: alertType.color,
    };
  }
  return map;
}
