import { alertDisplayLabel, resolveAlertType } from '@/data/alertTypes';
import { cityKey } from '@/lib/geo';
import { eventTime } from '@/lib/time';
import type { AlertEvent } from '@/types/alerts';
import type { MapCityMeta } from '@/types/alerts';

/**
 * Build per-city popup metadata for the map. Selected event cities win when they
 * overlap with earlier events in the list.
 */
export function buildCityMeta(
  events: AlertEvent[],
  selectedEvent: AlertEvent | null,
  language: string,
): Record<string, MapCityMeta> {
  const sorted = [...events].sort((a, b) => {
    const ta = eventTime(a)?.getTime() ?? 0;
    const tb = eventTime(b)?.getTime() ?? 0;
    return ta - tb;
  });

  const map: Record<string, MapCityMeta> = {};
  for (const event of sorted) {
    const alertType = resolveAlertType(event);
    const label = alertDisplayLabel(event, language);
    for (const city of event.cities) {
      const key = cityKey(city.name);
      map[key] = { eventId: event.id, name: city.name, label, color: alertType.color };
    }
  }

  if (selectedEvent) {
    const alertType = resolveAlertType(selectedEvent);
    const label = alertDisplayLabel(selectedEvent, language);
    for (const city of selectedEvent.cities) {
      const key = cityKey(city.name);
      map[key] = {
        eventId: selectedEvent.id,
        name: city.name,
        label,
        color: alertType.color,
      };
    }
  }

  return map;
}
