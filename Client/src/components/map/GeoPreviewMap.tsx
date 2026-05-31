import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { LngLat } from '@/types/alerts';
import { CONFIG } from '@/data/config';
import { DARK_STYLE, LIGHT_STYLE } from './mapStyle';
import { ensurePinImages, PIN_ACTIVE_IMAGE } from './pin';

const SOURCE_ID = 'preview';
// Separate source for the "show all cities" overlay so fitting the camera only
// considers the selected city's current/candidate points, not every city.
const SOURCE_ALL = 'preview-all';

/** Layer ids, one set per "kind" (the saved value vs. the candidate preview). */
const LAYERS = {
  currentFill: 'preview-current-fill',
  currentLine: 'preview-current-line',
  currentPoint: 'preview-current-point',
  candidateFill: 'preview-candidate-fill',
  candidateLine: 'preview-candidate-line',
  candidatePoint: 'preview-candidate-point',
};

// "All cities" overlay layers - drawn exactly like a live event (red active
// area / red active pin) so the operator sees how an event there would look.
const ALL_FILL = 'preview-all-fill';
const ALL_LINE = 'preview-all-line';
const ALL_MARKER = 'preview-all-marker';

const CURRENT_COLOR = '#f59e0b'; // amber - the city's currently-stored points
const CANDIDATE_COLOR = '#10b981'; // emerald - the alternative being previewed
const EVENT_COLOR = '#ef4444'; // red - matches the live map's ACTIVE event style

type FeatureCollection = GeoJSON.FeatureCollection;

/** One city with resolved points, for the "show all cities" overlay. */
export interface PreviewCity {
  id: string;
  name: string;
  points: LngLat[];
}

/** Close a ring (first === last) so it forms a valid GeoJSON polygon. */
function closedRing(points: LngLat[]): LngLat[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

/** A polygon (>=2 points) or point (1 point) geometry, or null when empty. */
function pointsToGeometry(points: LngLat[]): GeoJSON.Geometry | null {
  if (points.length >= 2) {
    return { type: 'Polygon', coordinates: [closedRing(points)] };
  }
  if (points.length === 1) {
    return { type: 'Point', coordinates: points[0] };
  }
  return null;
}

/** A polygon/point feature tagged with its kind (current vs. candidate). */
function toFeature(points: LngLat[], kind: 'current' | 'candidate'): GeoJSON.Feature | null {
  const geometry = pointsToGeometry(points);
  return geometry ? { type: 'Feature', properties: { kind }, geometry } : null;
}

function buildCollection(current: LngLat[] | null, candidate: LngLat[] | null): FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const cur = current && toFeature(current, 'current');
  const cand = candidate && toFeature(candidate, 'candidate');
  if (cur) features.push(cur);
  if (cand) features.push(cand);
  return { type: 'FeatureCollection', features };
}

/** Every city's stored points as event-style features (polygon area / point),
 *  each carrying its `name` so hovering can show which city it is. */
function buildAllCollection(cities: PreviewCity[] | null): FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const city of cities ?? []) {
    const geometry = pointsToGeometry(city.points);
    if (geometry) features.push({ type: 'Feature', properties: { name: city.name }, geometry });
  }
  return { type: 'FeatureCollection', features };
}

function addLayers(map: maplibregl.Map) {
  const fill = (id: string, color: string, kind: string) => {
    if (map.getLayer(id)) return;
    map.addLayer({
      id,
      type: 'fill',
      source: SOURCE_ID,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'kind'], kind]],
      paint: { 'fill-color': color, 'fill-opacity': 0.35 },
    });
  };
  const line = (id: string, color: string, kind: string) => {
    if (map.getLayer(id)) return;
    map.addLayer({
      id,
      type: 'line',
      source: SOURCE_ID,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'kind'], kind]],
      paint: { 'line-color': color, 'line-width': 2 },
    });
  };
  const circle = (id: string, color: string, kind: string) => {
    if (map.getLayer(id)) return;
    map.addLayer({
      id,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'kind'], kind]],
      paint: {
        'circle-radius': 7,
        'circle-color': color,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  };
  // "All cities" overlay (own source), drawn first so the selected city's
  // current/candidate layers sit on top. Polygons -> red active-event area;
  // single points -> the same red teardrop pin the live map uses.
  if (!map.getLayer(ALL_FILL)) {
    map.addLayer({
      id: ALL_FILL,
      type: 'fill',
      source: SOURCE_ALL,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': EVENT_COLOR, 'fill-opacity': 0.45 },
    });
  }
  if (!map.getLayer(ALL_LINE)) {
    map.addLayer({
      id: ALL_LINE,
      type: 'line',
      source: SOURCE_ALL,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'line-color': EVENT_COLOR, 'line-width': 2 },
    });
  }
  if (!map.getLayer(ALL_MARKER)) {
    map.addLayer({
      id: ALL_MARKER,
      type: 'symbol',
      source: SOURCE_ALL,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'icon-image': PIN_ACTIVE_IMAGE,
        'icon-size': 1,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }

  fill(LAYERS.currentFill, CURRENT_COLOR, 'current');
  line(LAYERS.currentLine, CURRENT_COLOR, 'current');
  circle(LAYERS.currentPoint, CURRENT_COLOR, 'current');
  fill(LAYERS.candidateFill, CANDIDATE_COLOR, 'candidate');
  line(LAYERS.candidateLine, CANDIDATE_COLOR, 'candidate');
  circle(LAYERS.candidatePoint, CANDIDATE_COLOR, 'candidate');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Show the city name on hover over the "all cities" overlay (fill + markers). */
function bindHover(map: maplibregl.Map) {
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'alert-popup',
  });
  const show = (e: maplibregl.MapLayerMouseEvent) => {
    const name = e.features?.[0]?.properties?.name;
    if (typeof name !== 'string') return;
    map.getCanvas().style.cursor = 'pointer';
    popup.setLngLat(e.lngLat).setHTML(`<div class="alert-popup__name">${escapeHtml(name)}</div>`).addTo(map);
  };
  const hide = () => {
    map.getCanvas().style.cursor = '';
    popup.remove();
  };
  for (const layer of [ALL_FILL, ALL_MARKER]) {
    map.on('mousemove', layer, show);
    map.on('mouseleave', layer, hide);
  }
}

/** Fit the camera to every drawn point (with a little padding). */
function fitToData(map: maplibregl.Map, current: LngLat[] | null, candidate: LngLat[] | null) {
  const all = [...(current ?? []), ...(candidate ?? [])];
  if (all.length === 0) return;
  if (all.length === 1) {
    map.easeTo({ center: all[0], zoom: CONFIG.MAP_FOCUS_ZOOM });
    return;
  }
  const bounds = all.reduce(
    (b, p) => b.extend(p),
    new maplibregl.LngLatBounds(all[0], all[0]),
  );
  map.fitBounds(bounds, { padding: 48, maxZoom: CONFIG.MAP_FOCUS_ZOOM, duration: 600 });
}

export interface GeoPreviewMapProps {
  /** The city's currently-stored points (amber), or null/empty if none. */
  current: LngLat[] | null;
  /** The alternative being previewed (emerald), or null if none selected. */
  candidate: LngLat[] | null;
  /** Every city to overlay as event-style geometry ("show all cities"), or null. */
  allCities?: PreviewCity[] | null;
}

/** A small standalone maplibre map that previews stored vs. candidate points. */
export function GeoPreviewMap({ current, candidate, allCities = null }: GeoPreviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const { resolvedTheme } = useTheme();

  const dataRef = useRef({ current, candidate, allCities });
  dataRef.current = { current, candidate, allCities };

  function addSources(map: maplibregl.Map) {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: buildCollection(dataRef.current.current, dataRef.current.candidate),
      });
    }
    if (!map.getSource(SOURCE_ALL)) {
      map.addSource(SOURCE_ALL, {
        type: 'geojson',
        data: buildAllCollection(dataRef.current.allCities),
      });
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolvedTheme === 'light' ? LIGHT_STYLE : DARK_STYLE,
      center: CONFIG.MAP_CENTER,
      zoom: CONFIG.MAP_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    map.on('load', () => {
      addSources(map);
      ensurePinImages(map);
      addLayers(map);
      bindHover(map);
      readyRef.current = true;
      fitToData(map, dataRef.current.current, dataRef.current.candidate);
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap basemap on theme change, re-adding the sources + layers afterwards.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(resolvedTheme === 'light' ? LIGHT_STYLE : DARK_STYLE, { diff: false });
    map.once('styledata', () => {
      addSources(map);
      ensurePinImages(map);
      addLayers(map);
    });
  }, [resolvedTheme]);

  // Push new geometry + refit whenever the selected city's points change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(buildCollection(current, candidate));
    fitToData(map, current, candidate);
  }, [current, candidate]);

  // Update the "all cities" overlay without refitting the camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const source = map.getSource(SOURCE_ALL) as maplibregl.GeoJSONSource | undefined;
    source?.setData(buildAllCollection(allCities));
  }, [allCities]);

  return <div ref={containerRef} className="h-full w-full" />;
}
