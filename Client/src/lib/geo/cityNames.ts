/**
 * Display-only Hebrew -> English localization of Oref city/area names.
 *
 * Dictionary: ./cityNamesEn.json, generated from Pikud HaOref's public
 * bilingual districts list (regenerate with `npm run generate:city-names`).
 * The JSON is lazy-imported into its own chunk so Hebrew sessions never
 * download it; until it arrives every lookup falls back to the input name.
 *
 * IMPORTANT: city names are identity keys across the app (cityKey(), focus
 * requests, map feature `name`, analytics grouping). Localized output is for
 * RENDERING ONLY — never feed it back into keys, stores, or filters.
 */

type CityNamesDict = Readonly<Record<string, string>>;

let dict: CityNamesDict | null = null;
let looseIndex: Map<string, string> | null = null;
let baseIndex: Map<string, string> | null = null;
let version = 0;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

const HEBREW_RE = /[֐-׿]/;

/**
 * Looser sibling of normalizeCityName (./index.ts) that KEEPS the " - "
 * sub-area suffix: dictionary keys are full Oref labels, so dropping the
 * suffix here would collapse distinct areas onto one key.
 */
function normalizeLoose(name: string): string {
  let value = (name || '').trim();
  value = value.replace(/[֑-ׇ]/g, ''); // niqqud / cantillation
  value = value.replace(/['"׳״`]/g, ''); // quotes / gershayim
  value = value.replace(/[־–—]/g, '-'); // dash variants -> hyphen
  value = value.replace(/\s*-\s*/g, '-'); // compact spacing around hyphens
  value = value.replace(/\s+/g, ' ').trim();
  value = value.replace(/קריית/g, 'קרית');
  return value;
}

/** Same shape as cityKey() output: hyphens become single spaces. */
function toSpaceForm(value: string): string {
  return value.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Drop the Oref " - " sub-area suffix ("תל אביב - מרכז העיר" -> "תל אביב").
 * Plain hyphenated names ("מעלות-תרשיחא") have no spaced dash and pass through.
 */
function stripSuffix(name: string): string {
  const unified = (name || '').replace(/[־–—]/g, '-');
  return unified.split(/\s+-\s+/)[0] ?? unified;
}

function baseKeyOf(name: string): string {
  return toSpaceForm(normalizeLoose(stripSuffix(name)));
}

function buildIndexes(source: CityNamesDict): void {
  const loose = new Map<string, string>();
  const base = new Map<string, string>();
  // Base keys backed by an unsuffixed dictionary entry must not be overwritten
  // by a sub-area sibling sharing the same base name.
  const baseFromUnsuffixed = new Set<string>();

  for (const [he, en] of Object.entries(source)) {
    const looseKey = normalizeLoose(he);
    if (!loose.has(looseKey)) loose.set(looseKey, en);

    const baseKey = baseKeyOf(he);
    const isUnsuffixed = stripSuffix(he) === he;
    if (!base.has(baseKey) || (isUnsuffixed && !baseFromUnsuffixed.has(baseKey))) {
      base.set(baseKey, stripSuffix(en).trim());
      if (isUnsuffixed) baseFromUnsuffixed.add(baseKey);
    }
  }

  looseIndex = loose;
  baseIndex = base;
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Idempotently load the dictionary chunk; safe to call from anywhere. */
export function preloadCityNames(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = import('./cityNamesEn.json')
    .then((mod) => {
      const loaded = mod.default as CityNamesDict;
      buildIndexes(loaded); // indexes first: a throw here leaves the module fully unloaded
      dict = loaded;
      version = 1;
      notify();
    })
    .catch((error: unknown) => {
      loadPromise = null; // let a later trigger retry
      console.error('Failed to load the city name dictionary', error);
    });
  return loadPromise;
}

/** Subscribe to dictionary arrival (for useSyncExternalStore). */
export function subscribeCityNames(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 0 = dictionary not loaded yet, 1 = loaded. */
export function getCityNamesVersion(): number {
  return version;
}

/**
 * Localize one Oref area name for display. Hebrew mode (or a not-yet-loaded
 * dictionary) returns the input unchanged. English mode resolves via:
 * exact label -> loose-normalized label -> base name (suffix dropped, which
 * also covers cityKey()-shaped inputs) -> the original Hebrew, wrapped in
 * Unicode bidi isolates so it cannot scramble a comma-joined English list.
 */
export function localizeCityName(name: string, language: string): string {
  if (!name || !language.startsWith('en') || !dict) return name;

  const exact = dict[name];
  if (exact) return exact;

  const loose = looseIndex?.get(normalizeLoose(name));
  if (loose) return loose;

  const base = baseIndex?.get(baseKeyOf(name));
  if (base) return base;

  return HEBREW_RE.test(name) ? `⁨${name}⁩` : name;
}

/** Map helper for joined lists; short-circuits outside English mode. */
export function localizeCityNames(names: string[], language: string): string[] {
  if (!language.startsWith('en') || !dict) return names;
  return names.map((name) => localizeCityName(name, language));
}
