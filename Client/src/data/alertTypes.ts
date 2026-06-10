/**
 * Alert display types keyed by the Hebrew title prefix Oref sends (text before
 * " - " when the shelter instruction is appended). Update this file when new
 * title strings appear in prod.
 *
 * --- SQL: all titles in the database (run in MySQL Workbench) ---
 *
 * SELECT
 *   id,
 *   text,
 *   SUBSTRING_INDEX(text, ' - ', 1) AS title_prefix,
 *   created_at
 * FROM `RedAlerts-PROD`.titles
 * ORDER BY text;
 *
 * --- SQL: titles seen on events with category (helps pick key + color) ---
 *
 * SELECT
 *   SUBSTRING_INDEX(t.text, ' - ', 1) AS title_prefix,
 *   t.text          AS title_text,
 *   c.code          AS category_code,
 *   COUNT(e.id)     AS event_count
 * FROM `RedAlerts-PROD`.events e
 * JOIN `RedAlerts-PROD`.titles t      ON t.id = e.title_id
 * JOIN `RedAlerts-PROD`.categories c  ON c.id = e.category_id
 * GROUP BY title_prefix, t.text, c.code
 * ORDER BY event_count DESC, title_prefix;
 */
import type { AlertEvent } from '@/types/alerts';
import type {
  AlertTypeDefinition,
  ResolvedAlertType,
} from '@/types/alerts';

/**
 * Known Oref title prefixes → display metadata.
 * Key = Hebrew prefix exactly as Oref sends it in `title` (before " - ").
 */
export const ALERT_TYPES: Record<string, AlertTypeDefinition> = {
  'ירי רקטות וטילים': {
    key: 'rockets',
    labelEn: 'Rocket and missile fire',
    labelHe: 'ירי רקטות וטילים',
    color: '#ef4444',
    icon: 'Rocket',
  },
  'כלי טייס עוין': {
    key: 'hostileAircraft',
    labelEn: 'Unidentified aircraft',
    labelHe: 'כלי טייס עוין',
    color: '#f97316',
    icon: 'Plane',
  },
  'איום מלבנון': {
    key: 'lebanonThreat',
    labelEn: 'Lebanon threat',
    labelHe: 'איום מלבנון',
    color: '#f59e0b',
    icon: 'Radio',
  },
  'האירוע הסתיים': {
    key: 'eventEnded',
    labelEn: 'Event ended',
    labelHe: 'האירוע הסתיים',
    color: '#22c55e',
    icon: 'TriangleAlert',
  },
  'חדירת מחבלים': {
    key: 'infiltration',
    labelEn: 'Terrorist infiltration',
    labelHe: 'חדירת מחבלים',
    color: '#a855f7',
    icon: 'Users',
  },
  'אירוע חדירת מחבלים הסתיים': {
    key: 'infiltrationEnded',
    labelEn: 'Infiltration event ended',
    labelHe: 'אירוע חדירת מחבלים הסתיים',
    color: '#22c55e',
    icon: 'Users',
  },
  // Oref sometimes sends the shelter instruction alone as the whole title.
  'התקרבו למרחב מוגן': {
    key: 'approachShelter',
    labelEn: 'Approach a protected area',
    labelHe: 'התקרבו למרחב מוגן',
    color: '#eab308',
    icon: 'TriangleAlert',
  },
};

const DEFAULT_TYPE: AlertTypeDefinition = {
  key: 'unknown',
  labelEn: 'Security alert',
  labelHe: 'התרעה ביטחונית',
  color: '#f97316',
  icon: 'TriangleAlert',
};

/** Split title from shelter instruction (handles `-`, `–`, `—`). */
const TITLE_INSTRUCTION_SPLIT = /\s[-–—]\s/;

/** Strip the shelter-instruction suffix Oref sometimes appends after " - ". */
export function titlePrefix(title: string | null | undefined): string {
  const trimmed = (title ?? '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(TITLE_INSTRUCTION_SPLIT);
  return parts[0]?.trim() ?? trimmed;
}

/** Instruction text after the dash separator, if present. */
export function titleInstruction(title: string | null | undefined): string | null {
  const trimmed = (title ?? '').trim();
  const match = trimmed.match(TITLE_INSTRUCTION_SPLIT);
  if (!match || match.index === undefined) return null;
  const instruction = trimmed.slice(match.index + match[0].length).trim();
  return instruction || null;
}

/** Known spelling variants → canonical ALERT_TYPES key. */
const PREFIX_ALIASES: Record<string, string> = {
  'כלי טיס עוין': 'כלי טייס עוין',
};

function normalizePrefix(prefix: string): string {
  const nfc = prefix.normalize('NFC').replace(/\s+/g, ' ').trim();
  return PREFIX_ALIASES[nfc] ?? nfc;
}

function lookupAlertType(prefix: string): AlertTypeDefinition | undefined {
  const normalized = normalizePrefix(prefix);
  if (ALERT_TYPES[normalized]) return ALERT_TYPES[normalized];
  const knownKey = Object.keys(ALERT_TYPES).find((key) => normalized.startsWith(key));
  return knownKey ? ALERT_TYPES[knownKey] : undefined;
}

/** Common Oref shelter-instruction phrases → English. */
const INSTRUCTION_EN: Record<string, string> = {
  'היכנסו למרחב המוגן': 'Enter the protected area',
  'היכנסו מייד למרחב המוגן': 'Enter the protected area immediately',
  'התקרבו למרחב מוגן': 'Approach a protected area',
  'התקרבו למרחב המוגן': 'Approach the protected area',
};

/** Localized shelter instruction for feed subtitles. */
export function instructionDisplay(text: string | null | undefined, language: string): string | null {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  if (language.startsWith('he')) return trimmed;
  return INSTRUCTION_EN[trimmed] ?? trimmed;
}

/** Map an event's title to display metadata (color, labels, icon key). */
export function resolveAlertType(
  event: Pick<AlertEvent, 'title' | 'category'>,
): ResolvedAlertType {
  const prefix = titlePrefix(event.title?.text);
  const mapped = prefix ? lookupAlertType(prefix) : undefined;

  if (mapped) {
    return { ...mapped, titleKey: prefix, isFallback: false };
  }

  if (prefix) {
    return {
      key: 'unmapped',
      labelEn: prefix,
      labelHe: prefix,
      color: DEFAULT_TYPE.color,
      icon: DEFAULT_TYPE.icon,
      titleKey: prefix,
      isFallback: true,
    };
  }

  return { ...DEFAULT_TYPE, titleKey: '', isFallback: true };
}

/** Localized headline for feed, map popups, and toasts. */
export function alertDisplayLabel(
  event: Pick<AlertEvent, 'title' | 'category'>,
  language: string,
): string {
  const type = resolveAlertType(event);
  return language.startsWith('he') ? type.labelHe : type.labelEn;
}

/** 10% opacity background for icon badges. */
export function alertTypeBg(color: string): string {
  return `${color}1a`;
}
