import { useEffect, useRef } from 'react';
import maplibregl, { type FilterSpecification } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import { CONFIG } from '@/data/config';
import { buildCityFeatureCollection, resolveCity } from '@/lib/geo';
import { useAlertsStore } from '@/store/alertsStore';
import { DARK_STYLE, LIGHT_STYLE } from './mapStyle';

const SOURCE_ID = 'cities';
const LAYER_RECENT = 'alerts-recent-fill';
const LAYER_ACTIVE_FILL = 'alerts-active-fill';
const LAYER_ACTIVE_LINE = 'alerts-active-line';
const LAYER_SELECTED_LINE = 'alerts-selected-line';

function inNames(keys: string[]): FilterSpecification {
  return ['in', ['get', 'name'], ['literal', keys]] as unknown as FilterSpecification;
}

export interface AlertMapProps {
  activeKeys: string[];
  recentKeys: string[];
  selectedKey: string | null;
}

export function AlertMap({ activeKeys, recentKeys, selectedKey }: AlertMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const focusRequest = useAlertsStore((s) => s.focusRequest);

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
      map.addSource(SOURCE_ID, { type: 'geojson', data: buildCityFeatureCollection() });

      map.addLayer({
        id: LAYER_RECENT,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.18 },
        filter: inNames([]),
      });
      map.addLayer({
        id: LAYER_ACTIVE_FILL,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.45 },
        filter: inNames([]),
      });
      map.addLayer({
        id: LAYER_ACTIVE_LINE,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': '#ef4444', 'line-width': 2 },
        filter: inNames([]),
      });
      map.addLayer({
        id: LAYER_SELECTED_LINE,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': '#ffffff', 'line-width': 3 },
        filter: inNames([]),
      });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
      const showName = (e: maplibregl.MapLayerMouseEvent) => {
        const name = e.features?.[0]?.properties?.name;
        if (typeof name === 'string') {
          map.getCanvas().style.cursor = 'pointer';
          popup.setLngLat(e.lngLat).setText(name).addTo(map);
        }
      };
      const hideName = () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      };
      [LAYER_ACTIVE_FILL, LAYER_RECENT].forEach((layer) => {
        map.on('mousemove', layer, showName);
        map.on('mouseleave', layer, hideName);
      });

      readyRef.current = true;
      applyFilters(map, activeKeys, recentKeys, selectedKey);
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
        map.addSource(SOURCE_ID, { type: 'geojson', data: buildCityFeatureCollection() });
      }
      reAddLayers(map);
      applyFilters(map, activeKeys, recentKeys, selectedKey);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  // Re-apply highlight filters whenever the alert sets change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyFilters(map, activeKeys, recentKeys, selectedKey);
  }, [activeKeys, recentKeys, selectedKey]);

  // Fly to a focused area (from a feed click or a new live alert).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !focusRequest) return;
    const resolved = resolveCity(focusRequest.area);
    if (resolved) {
      map.flyTo({ center: resolved.center, zoom: CONFIG.MAP_FOCUS_ZOOM, speed: 1.2, essential: true });
    }
  }, [focusRequest]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}

function applyFilters(
  map: maplibregl.Map,
  activeKeys: string[],
  recentKeys: string[],
  selectedKey: string | null,
) {
  if (map.getLayer(LAYER_RECENT)) map.setFilter(LAYER_RECENT, inNames(recentKeys));
  if (map.getLayer(LAYER_ACTIVE_FILL)) map.setFilter(LAYER_ACTIVE_FILL, inNames(activeKeys));
  if (map.getLayer(LAYER_ACTIVE_LINE)) map.setFilter(LAYER_ACTIVE_LINE, inNames(activeKeys));
  if (map.getLayer(LAYER_SELECTED_LINE)) {
    map.setFilter(LAYER_SELECTED_LINE, inNames(selectedKey ? [selectedKey] : []));
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
