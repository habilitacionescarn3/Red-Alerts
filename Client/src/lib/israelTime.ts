/** Israel-local calendar/time helpers (Asia/Jerusalem). */

import { MINUTES_PER_DAY, MS_PER_MINUTE } from '@/lib/time';

export const ISRAEL_TZ = 'Asia/Jerusalem';

const DAY_MS = MINUTES_PER_DAY * MS_PER_MINUTE;

/** YYYY-MM-DD for a moment in Israel local time. */
export function israelDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ISRAEL_TZ }).format(d);
}

/** Minutes from local midnight in Israel for a UTC instant. */
export function israelMinutesFromMidnight(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function israelLocalParts(d: Date): { date: string; minutes: number } {
  return { date: israelDateString(d), minutes: israelMinutesFromMidnight(d) };
}

/** UTC instant for an Israel-local date + minutes from midnight. */
export function israelDateTime(dateStr: string, totalMinutes: number): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetMinutes = Math.max(0, Math.min(totalMinutes, MINUTES_PER_DAY - 1));

  let low = Date.UTC(year, month - 1, day - 1);
  let high = Date.UTC(year, month - 1, day + 2);

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const test = new Date(mid);
    const { date, minutes } = israelLocalParts(test);
    if (date === dateStr) {
      if (minutes < targetMinutes) low = mid + MS_PER_MINUTE;
      else if (minutes > targetMinutes) high = mid;
      else return test;
    } else if (date < dateStr) {
      low = mid + MS_PER_MINUTE;
    } else {
      high = mid;
    }
  }

  return new Date(low);
}

/** `[start, end)` UTC bounds for one Israel-local day. */
export function israelDayBounds(dateStr: string): { start: Date; end: Date } {
  return {
    start: israelDateTime(dateStr, 0),
    end: israelDateTime(dateStr, MINUTES_PER_DAY - 1),
  };
}

/** Full-day range for a selected Israel date. */
export function israelFullDayRange(dateStr: string): { start: Date; end: Date } {
  const { start } = israelDayBounds(dateStr);
  return { start, end: new Date(start.getTime() + DAY_MS - 1) };
}

/** Default live window: last N minutes through now, clamped to the selected day. */
export function israelLiveRange(
  dateStr: string,
  windowMinutes: number,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const end = now;
  let start = new Date(now.getTime() - windowMinutes * MS_PER_MINUTE);
  const dayStart = israelDateTime(dateStr, 0);
  if (start < dayStart) start = dayStart;
  return { start, end };
}

export function parseIsraelYearMonth(dateStr: string): { year: number; month: number } {
  const [year, month] = dateStr.split('-').map(Number);
  return { year, month };
}

export function shiftIsraelMonth(dateStr: string, delta: number): string {
  const { year, month } = parseIsraelYearMonth(dateStr);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function daysInIsraelMonth(dateStr: string): number {
  const { year, month } = parseIsraelYearMonth(dateStr);
  return new Date(year, month, 0).getDate();
}

export function formatIsraelMonthLabel(dateStr: string, lang: string): string {
  const { year, month } = parseIsraelYearMonth(`${dateStr.slice(0, 7)}-01`);
  return new Intl.DateTimeFormat(lang, {
    month: 'long',
    year: 'numeric',
    timeZone: ISRAEL_TZ,
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}

export function formatIsraelClock(totalMinutes: number, lang: string): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const d = new Date(Date.UTC(2000, 0, 1, hours, mins));
  return new Intl.DateTimeFormat(lang, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(d);
}

/** Parse HH:mm (Israel-local clock param) → minutes from midnight. */
export function parseIsraelClockParam(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes from midnight → HH:mm for URL params. */
export function formatIsraelClockParam(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
