import type { BasemapId } from './mapStyle';

/**
 * Preview tile over Haifa + inland (Kiryat Ata / Nesher area), not open sea.
 * z6/x38/y25 — used for the real satellite (EOX) thumbnail.
 */
const Z = 6;
const X = 38;
const Y = 25;

/**
 * Dark/Light are OpenFreeMap vector styles with no single raster tile to preview,
 * so we render a tiny keyless inline SVG swatch (a stylised mini-map) instead — no
 * extra network request, no third-party tiles.
 */
const swatch = (bg: string, line: string, dot: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='76' height='48'>` +
      `<rect width='76' height='48' fill='${bg}'/>` +
      `<path d='M0 32 L76 16' stroke='${line}' stroke-width='3' fill='none'/>` +
      `<path d='M22 0 L34 48' stroke='${line}' stroke-width='2' fill='none'/>` +
      `<circle cx='50' cy='27' r='3' fill='${dot}'/>` +
      `</svg>`,
  );

const PREVIEWS: Record<BasemapId, string> = {
  dark: swatch('#1d2330', '#3a4151', '#6b7280'),
  light: swatch('#eae6df', '#c9c2b6', '#9aa0a6'),
  // "Satellite" is backed by EOX Sentinel-2 cloudless (real imagery thumbnail).
  satellite: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/${Z}/${Y}/${X}.jpg`,
};

/** Thumbnail URL for the basemap picker. */
export function getBasemapPreviewUrl(id: BasemapId): string {
  return PREVIEWS[id];
}
