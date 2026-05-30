import type { StyleSpecification } from 'maplibre-gl';

/**
 * A keyless raster basemap (CARTO dark/light tiles over OpenStreetMap data).
 * No API token required. We intentionally avoid vector glyphs so we never have
 * to ship Hebrew fonts for map labels - area names are shown via HTML popups
 * and the side feed instead.
 */
function rasterStyle(tilesTemplate: string, attribution: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [
          tilesTemplate.replace('{s}', 'a'),
          tilesTemplate.replace('{s}', 'b'),
          tilesTemplate.replace('{s}', 'c'),
        ],
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0b0b0e' } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
    ],
  };
}

const ATTRIBUTION = '© OpenStreetMap contributors © CARTO';

export const DARK_STYLE = rasterStyle(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  ATTRIBUTION,
);

export const LIGHT_STYLE = rasterStyle(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  ATTRIBUTION,
);
