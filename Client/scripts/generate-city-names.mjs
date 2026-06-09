/**
 * Generate the Hebrew -> English city/area name dictionary used for
 * display-only localization (src/lib/geo/cityNames.ts).
 *
 * Source: Pikud HaOref's (Israel Home Front Command) public bilingual
 * districts list — the same list Oref's alert feed draws its area names from,
 * so `label_he` matches alert names exactly (including sub-areas like
 * "תל אביב - מרכז העיר" -> "Tel Aviv - City Center").
 *
 *   https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=en
 *
 * Only the label_he/label pairs are kept; all other fields are dropped.
 * Output: src/lib/geo/cityNamesEn.json (committed; lazy-loaded by the client).
 *
 * Regenerate (from Client/): npm run generate:city-names
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=en';
const OUT_URL = new URL('../src/lib/geo/cityNamesEn.json', import.meta.url);

// Sample pair that must survive generation — guards against the endpoint
// changing shape or language under us.
const SANITY_HE = 'תל אביב - מרכז העיר';
const SANITY_EN = 'Tel Aviv - City Center';

const res = await fetch(SOURCE_URL, {
  headers: {
    // Same defensive Referer the backend poller sends to Oref.
    Referer: 'https://www.oref.org.il/',
    Accept: 'application/json, text/plain, */*',
  },
});
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const entries = await res.json();
if (!Array.isArray(entries) || entries.length < 1000) {
  const got = Array.isArray(entries) ? `${entries.length} entries` : typeof entries;
  console.error(`Unexpected payload: expected an array of >1000 districts, got ${got}`);
  process.exit(1);
}

const pairs = {};
let conflicts = 0;
for (const entry of entries) {
  const he = typeof entry?.label_he === 'string' ? entry.label_he.trim() : '';
  const en = typeof entry?.label === 'string' ? entry.label.trim() : '';
  if (!he || !en) continue;
  if (pairs[he] !== undefined && pairs[he] !== en) {
    conflicts += 1;
    console.warn(`Conflicting English for "${he}": "${pairs[he]}" vs "${en}" (keeping the first)`);
    continue;
  }
  pairs[he] = en;
}

if (pairs[SANITY_HE] !== SANITY_EN) {
  console.error(`Sanity check failed: "${SANITY_HE}" -> "${pairs[SANITY_HE]}", expected "${SANITY_EN}"`);
  console.error(
    'If Oref legitimately renamed this area (check the source URL above), update SANITY_HE/SANITY_EN in this script.',
  );
  process.exit(1);
}

// Codepoint-sorted keys for stable diffs across regenerations.
const sorted = Object.fromEntries(
  Object.entries(pairs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
);
const json = `${JSON.stringify(sorted, null, 1)}\n`;
await writeFile(OUT_URL, json);

console.log(
  `Wrote ${Object.keys(sorted).length} name pairs (${Buffer.byteLength(json)} bytes, ` +
    `${conflicts} conflicts) to ${fileURLToPath(OUT_URL)}`,
);
