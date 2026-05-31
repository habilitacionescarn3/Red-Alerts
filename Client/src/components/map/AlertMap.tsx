import { useEffect, useRef } from 'react';
import maplibregl, { type FilterSpecification } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import { CONFIG } from '@/data/config';
import { cityKey, resolveCity } from '@/lib/geo';
import { useAlertsStore } from '@/store/alertsStore';
import type { CityFeatureCollection } from '@/types/geo';
import { DARK_STYLE, LIGHT_STYLE } from './mapStyle';

const SOURCE_ID = 'cities';
const LAYER_RECENT = 'alerts-recent-fill';
const LAYER_ACTIVE_FILL = 'alerts-active-fill';
const LAYER_ACTIVE_LINE = 'alerts-active-line';
const LAYER_SELECTED_LINE = 'alerts-selected-line';
// Marker (single-point) layers - circles render only Point features, while the
// fill/line layers above render only Polygons, so each city draws as exactly one.
const LAYER_RECENT_MARKER = 'alerts-recent-marker';
const LAYER_ACTIVE_MARKER = 'alerts-active-marker';
const LAYER_SELECTED_MARKER = 'alerts-selected-marker';

// Layers whose features are hoverable + clickable (the highlighted areas/markers).
const INTERACTIVE_LAYERS = [
  LAYER_ACTIVE_FILL,
  LAYER_RECENT,
  LAYER_ACTIVE_MARKER,
  LAYER_RECENT_MARKER,
  LAYER_SELECTED_MARKER,
];

function inNames(keys: string[]): FilterSpecification {
  return ['in', ['get', 'name'], ['literal', keys]] as unknown as FilterSpecification;
}

/** Same name filter, but only Polygon features (the drawn areas). */
function areasInNames(keys: string[]): FilterSpecification {
  return [
    'all',
    ['==', ['geometry-type'], 'Polygon'],
    ['in', ['get', 'name'], ['literal', keys]],
  ] as unknown as FilterSpecification;
}

/**
 * Same name filter, but only Point features. Without this a `circle` layer would
 * draw a dot at EVERY vertex of a matching polygon, so area cities would show a
 * ring of circles. Markers are for single-point cities only.
 */
/**
 * Point features in `keys`, optionally minus `exclude` (so a single point is
 * only ever drawn by ONE pin layer - selected wins over active wins over recent).
 */
function pointsInNames(keys: string[], exclude: string[] = []): FilterSpecification {
  const parts: unknown[] = [
    'all',
    ['==', ['geometry-type'], 'Point'],
    ['in', ['get', 'name'], ['literal', keys]],
  ];
  if (exclude.length) parts.push(['!', ['in', ['get', 'name'], ['literal', exclude]]]);
  return parts as unknown as FilterSpecification;
}

const PIN_ACTIVE_IMAGE = 'alert-pin-active';
const PIN_RECENT_IMAGE = 'alert-pin-recent';
const PIN_SELECTED_IMAGE = 'alert-pin-selected';

/** Draw a Google-Maps-style teardrop pin (colored body, outline + hole). */
function makePinImage(fill: string, stroke = '#ffffff', hole = '#ffffff'): ImageData {
  const pr = 2; // render at 2x for crisp edges (addImage uses pixelRatio: 2)
  const w = 30 * pr;
  const h = 40 * pr;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new ImageData(w, h);

  const cx = w / 2;
  const r = w * 0.32;
  const lw = w * 0.06;
  const cy = r + lw;
  const tipY = h - lw;

  // Teardrop silhouette: top semicircle with straight sides meeting at the tip.
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI, false);
  ctx.lineTo(cx, tipY);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  // Hole in the head.
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, 2 * Math.PI);
  ctx.fillStyle = hole;
  ctx.fill();

  return ctx.getImageData(0, 0, w, h);
}

/** Register the pin images on the map (idempotent; images are wiped by setStyle). */
function ensurePinImages(map: maplibregl.Map) {
  if (!map.hasImage(PIN_ACTIVE_IMAGE)) {
    map.addImage(PIN_ACTIVE_IMAGE, makePinImage('#ef4444'), { pixelRatio: 2 });
  }
  if (!map.hasImage(PIN_RECENT_IMAGE)) {
    map.addImage(PIN_RECENT_IMAGE, makePinImage('#f59e0b'), { pixelRatio: 2 });
  }
  // Selected pin: white body + dark outline + red hole, distinct on any basemap.
  if (!map.hasImage(PIN_SELECTED_IMAGE)) {
    map.addImage(PIN_SELECTED_IMAGE, makePinImage('#ffffff', '#1f2937', '#ef4444'), {
      pixelRatio: 2,
    });
  }
}

/** Per-city display info for the hover popup + click-to-select (keyed by cityKey). */
export interface MapCityMeta {
  /** Event to select when this city is clicked. */
  eventId: string;
  /** City name as delivered by Oref (shown in the popup). */
  name: string;
  /** Category label of the alert (shown in the popup). */
  label: string;
  /** Severity color of the alert (hex). */
  color: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function popupHtml(name: string, meta: MapCityMeta | undefined): string {
  const row = meta
    ? `<div class="alert-popup__row"><span class="alert-popup__dot" style="background:${meta.color}"></span><span style="color:${meta.color}">${escapeHtml(meta.label)}</span></div>`
    : '';
  return `${row}<div class="alert-popup__name">${escapeHtml(name)}</div>`;
}

export interface AlertMapProps {
  /** GeoJSON of the cities to draw (polygons for areas, points for markers). */
  featureCollection: CityFeatureCollection;
  activeKeys: string[];
  recentKeys: string[];
  /** cityKeys of every city in the currently selected event (the highlight set). */
  selectedKeys: string[];
  /** cityKey -> popup/selection info for the drawn cities. */
  cityMeta: Record<string, MapCityMeta>;
  /** Called with an event id when a city on the map is clicked. */
  onSelectEvent: (eventId: string) => void;
}

export function AlertMap({
  featureCollection,
  activeKeys,
  recentKeys,
  selectedKeys,
  cityMeta,
  onSelectEvent,
}: AlertMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const focusRequest = useAlertsStore((s) => s.focusRequest);

  // Keep the latest collection in a ref so the (style-change) re-add path and
  // the create-once effect always read current data without re-subscribing.
  const collectionRef = useRef(featureCollection);
  collectionRef.current = featureCollection;

  // Latest popup/selection data, read by the (once-bound) map event handlers.
  const cityMetaRef = useRef(cityMeta);
  cityMetaRef.current = cityMeta;
  const onSelectEventRef = useRef(onSelectEvent);
  onSelectEventRef.current = onSelectEvent;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolvedTheme === 'light' ? LIGHT_STYLE : DARK_STYLE,
      center: CONFIG.MAP_CENTER,
      zoom: CONFIG.MAP_ZOOM,
      minZoom: CONFIG.MAP_MIN_ZOOM,
      maxZoom: CONFIG.MAP_MAX_ZOOM,
      maxBounds: CONFIG.MAP_MAX_BOUNDS,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    map.on('load', () => {
      map.addSource(SOURCE_ID, { type: 'geojson', data: collectionRef.current });
      ensurePinImages(map);
      reAddLayers(map);

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'alert-popup',
      });
      const showFeature = (e: maplibregl.MapLayerMouseEvent) => {
        const key = e.features?.[0]?.properties?.name;
        if (typeof key !== 'string') return;
        const meta = cityMetaRef.current[key];
        map.getCanvas().style.cursor = 'pointer';
        popup.setLngLat(e.lngLat).setHTML(popupHtml(meta?.name ?? key, meta)).addTo(map);
      };
      const hideFeature = () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      };
      const selectFeature = (e: maplibregl.MapLayerMouseEvent) => {
        const key = e.features?.[0]?.properties?.name;
        if (typeof key !== 'string') return;
        const meta = cityMetaRef.current[key];
        if (meta) onSelectEventRef.current(meta.eventId);
      };
      INTERACTIVE_LAYERS.forEach((layer) => {
        map.on('mousemove', layer, showFeature);
        map.on('mouseleave', layer, hideFeature);
        map.on('click', layer, selectFeature);
      });

      readyRef.current = true;
      applyFilters(map, activeKeys, recentKeys, selectedKeys);
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap basemap when the color theme changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(resolvedTheme === 'light' ? LIGHT_STYLE : DARK_STYLE, { diff: false });
    map.once('styledata', () => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: 'geojson', data: collectionRef.current });
      }
      ensurePinImages(map);
      reAddLayers(map);
      applyFilters(map, activeKeys, recentKeys, selectedKeys);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  // Push new geometry into the source whenever the events/points change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(featureCollection);
  }, [featureCollection]);

  // Re-apply highlight filters whenever the alert sets change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyFilters(map, activeKeys, recentKeys, selectedKeys);
  }, [activeKeys, recentKeys, selectedKeys]);

  // Fly to a focused area (from a feed click or a new live alert).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !focusRequest) return;
    const center = focusCenter(focusRequest.area, collectionRef.current);
    if (center) {
      map.flyTo({ center, zoom: CONFIG.MAP_FOCUS_ZOOM, speed: 1.2, essential: true });
    }
  }, [focusRequest]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}

/** Resolve a fly-to target: prefer the drawn feature's center, else the bundled one. */
function focusCenter(
  area: string,
  collection: CityFeatureCollection,
): [number, number] | null {
  const key = cityKey(area);
  const feature = collection.features.find((f) => f.properties?.name === key);
  const center = feature?.properties?.center;
  if (center) return center;
  return resolveCity(area)?.center ?? null;
}

function applyFilters(
  map: maplibregl.Map,
  activeKeys: string[],
  recentKeys: string[],
  selectedKeys: string[],
) {
  if (map.getLayer(LAYER_RECENT)) map.setFilter(LAYER_RECENT, areasInNames(recentKeys));
  if (map.getLayer(LAYER_ACTIVE_FILL)) map.setFilter(LAYER_ACTIVE_FILL, areasInNames(activeKeys));
  if (map.getLayer(LAYER_ACTIVE_LINE)) map.setFilter(LAYER_ACTIVE_LINE, areasInNames(activeKeys));
  // Each point is drawn by exactly one pin layer: selected > active > recent.
  if (map.getLayer(LAYER_RECENT_MARKER)) {
    map.setFilter(LAYER_RECENT_MARKER, pointsInNames(recentKeys, [...activeKeys, ...selectedKeys]));
  }
  if (map.getLayer(LAYER_ACTIVE_MARKER)) {
    map.setFilter(LAYER_ACTIVE_MARKER, pointsInNames(activeKeys, selectedKeys));
  }
  if (map.getLayer(LAYER_SELECTED_MARKER)) {
    map.setFilter(LAYER_SELECTED_MARKER, pointsInNames(selectedKeys));
  }
  // White outline on every AREA city of the selected event.
  if (map.getLayer(LAYER_SELECTED_LINE)) {
    map.setFilter(LAYER_SELECTED_LINE, areasInNames(selectedKeys));
  }
}

function reAddLayers(map: maplibregl.Map) {
  if (!map.getLayer(LAYER_RECENT)) {
    map.addLayer({
      id: LAYER_RECENT,
      type: 'fill',
      source: SOURCE_ID,
      paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.18 },
      filter: inNames([]),
    });
  }
  if (!map.getLayer(LAYER_ACTIVE_FILL)) {
    map.addLayer({
      id: LAYER_ACTIVE_FILL,
      type: 'fill',
      source: SOURCE_ID,
      paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.45 },
      filter: inNames([]),
    });
  }
  if (!map.getLayer(LAYER_ACTIVE_LINE)) {
    map.addLayer({
      id: LAYER_ACTIVE_LINE,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': '#ef4444', 'line-width': 2 },
      filter: inNames([]),
    });
  }
  if (!map.getLayer(LAYER_RECENT_MARKER)) {
    map.addLayer({
      id: LAYER_RECENT_MARKER,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': PIN_RECENT_IMAGE,
        'icon-size': 0.85,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      filter: pointsInNames([]),
    });
  }
  if (!map.getLayer(LAYER_ACTIVE_MARKER)) {
    map.addLayer({
      id: LAYER_ACTIVE_MARKER,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': PIN_ACTIVE_IMAGE,
        'icon-size': 1,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      filter: pointsInNames([]),
    });
  }
  if (!map.getLayer(LAYER_SELECTED_MARKER)) {
    map.addLayer({
      id: LAYER_SELECTED_MARKER,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': PIN_SELECTED_IMAGE,
        'icon-size': 1.1,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      filter: pointsInNames([]),
    });
  }
  if (!map.getLayer(LAYER_SELECTED_LINE)) {
    map.addLayer({
      id: LAYER_SELECTED_LINE,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': '#ffffff', 'line-width': 3 },
      filter: inNames([]),
    });
  }
}
