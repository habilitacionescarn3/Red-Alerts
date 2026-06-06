import type { StyleSpecification } from 'maplibre-gl';
import { CONFIG } from '@/data/config';
import {
  buildLabelLayers,
  normalizeLabelLang,
  OPENFREEMAP_GLYPHS,
  LABEL_SOURCE,
  LABEL_SOURCE_ID,
  type LabelLang,
} from './labels';

/** User-selectable basemap modes (keyless, browser -> CDN, no account). */
export type BasemapId = 'dark' | 'light' | 'satellite';

export const BASEMAP_IDS: BasemapId[] = ['satellite', 'dark', 'light'];

/**
 * Dark/Light basemaps come from OpenFreeMap's hosted vector styles — keyless, no
 * account, no usage limits, commercial use allowed (https://openfreemap.org).
 * They already include their own (OSM) labels + attribution, so we do NOT add our
 * bilingual label overlay on top of them (only the label-less satellite gets it).
 */
const OPENFREEMAP_STYLE = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
} as const;

/**
 * EOX Sentinel-2 cloudless 2024 — the single satellite source. Keyless, no
 * account, no usage cap, free for non-commercial use. The text below matches the
 * exact attribution required at https://s2maps.eu (license: CC BY-NC-SA 4.0).
 */
const EOX_ATTRIBUTION =
  '<a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024) · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>';

const EOX_SATELLITE_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg';

/** Satellite imagery (EOX) plus keyless bilingual OpenFreeMap labels on top. */
function satelliteStyle(lang: LabelLang): StyleSpecification {
  return {
    version: 8,
    glyphs: OPENFREEMAP_GLYPHS,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [EOX_SATELLITE_TILES],
        tileSize: 256,
        attribution: EOX_ATTRIBUTION,
        maxzoom: 14,
      },
      [LABEL_SOURCE_ID]: LABEL_SOURCE,
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#1a1a2e' } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
      ...buildLabelLayers(lang),
    ],
  };
}

/** Shown alongside provider credits in the compact attribution control. */
export const MAPLIBRE_ATTRIBUTION =
  '© <a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">MapLibre</a>';

/** Native tile pyramid limit per basemap — beyond this MapLibre overzooms (blurry). */
export function getBasemapMaxZoom(basemapId: BasemapId): number {
  switch (basemapId) {
    case 'satellite':
      return 14;
    default:
      return CONFIG.MAP_MAX_ZOOM;
  }
}

/**
 * Resolve the MapLibre style for the chosen basemap, app theme, and language.
 * Dark/Light return an OpenFreeMap style URL (vector, with their own labels);
 * Satellite returns an inline style (EOX imagery + our bilingual label overlay).
 */
export function getBasemapStyle(
  basemapId: BasemapId,
  theme: string | undefined,
  language?: string,
): StyleSpecification | string {
  void theme;

  switch (basemapId) {
    case 'dark':
      return OPENFREEMAP_STYLE.dark;
    case 'light':
      return OPENFREEMAP_STYLE.light;
    case 'satellite':
      return satelliteStyle(normalizeLabelLang(language));
    default:
      return getBasemapStyle('satellite', theme, language);
  }
}
