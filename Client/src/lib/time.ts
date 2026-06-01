import { formatDistanceToNowStrict, format } from 'date-fns';
import { he, enUS, type Locale } from 'date-fns/locale';
import type { AlertEvent } from '@/types/alerts';

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MINUTES_PER_DAY = 24 * 60;

const LOCALES: Record<string, Locale> = { he, en: enUS };

function localeFor(lang: string): Locale {
  return LOCALES[lang] ?? enUS;
}

/**
 * Parse a backend ISO timestamp. The API emits NAIVE UTC strings (no offset,
 * e.g. "2026-05-31T12:00:00"); JS would otherwise read those as local time, so
 * we append a 'Z' when there is no timezone designator.
 */
export function parseEventDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const hasTz = /([zZ])|([+-]\d{2}:?\d{2})$/.test(iso);
  const date = new Date(hasTz ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The timestamp that best represents "when this event was last relevant". */
export function eventTime(event: AlertEvent): Date | null {
  return parseEventDate(event.last_seen_at ?? event.received_at);
}

/** Whether an event is still "active" (last seen within the given window). */
export function isActive(event: AlertEvent, windowMinutes: number): boolean {
  const date = eventTime(event);
  if (!date) return false;
  return Date.now() - date.getTime() <= windowMinutes * MS_PER_MINUTE;
}

export function formatRelative(date: Date | null, lang: string): string {
  if (!date) return '';
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: localeFor(lang) });
}

export function formatClock(date: Date | null, lang: string): string {
  if (!date) return '';
  return format(date, 'HH:mm', { locale: localeFor(lang) });
}
