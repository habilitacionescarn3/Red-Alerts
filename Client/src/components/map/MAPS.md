# Map providers

Single source of truth for every map source the client uses. Keep this in sync
with `mapStyle.ts` + `labels.ts`. Everything below is keyless (no API key, no
account). The **Terms** column deep‑links to the exact page that states the
licensing.

| Provider | Used for | Free? (extent) | Terms (direct link) |
| --- | --- | --- | --- |
| **EOX Sentinel‑2 cloudless 2024** | "Satellite" imagery — Home map + admin Geo preview | Free for **non‑commercial** use (CC BY‑NC‑SA 4.0). ⚠️ EOX **rate‑limits under heavy load** (can return HTTP errors), so it's "free" but not capacity‑guaranteed. Attribution required. | https://s2maps.eu/#license |
| **OpenFreeMap** (OSM / OpenMapTiles) | "Dark" + "Light" basemaps, **and** the bilingual place/road labels over Satellite | Free, **no limits on views/requests**, **commercial allowed**. Code MIT; data is OSM. | https://openfreemap.org/ |
| **OpenStreetMap** | Underlying data behind every OpenFreeMap style/label | Free, ODbL. Attribution `© OpenStreetMap contributors` required (auto‑added). | https://www.openstreetmap.org/copyright |
| **MapLibre GL JS** | Renderer | Free, BSD‑3. | https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt |
| **mapbox‑gl‑rtl‑text** | Right‑to‑left shaping so Hebrew labels render correctly | Free, BSD‑2. | https://github.com/mapbox/mapbox-gl-rtl-text/blob/main/LICENSE.md |

## Exact required attribution strings

- **EOX:** `Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)`
- **OpenStreetMap:** `© OpenStreetMap contributors`

## About `public/mapbox-gl-rtl-text.js` (not our code)

This file is the **official Mapbox/MapLibre RTL (right‑to‑left) text plugin**,
vendored verbatim from the npm package `@mapbox/mapbox-gl-rtl-text` (v0.4.0, the
prebuilt `dist` file with its WASM inlined). It is **not custom code we wrote**.

- **What it does:** MapLibre can't reorder right‑to‑left scripts on its own, so
  Hebrew/Arabic labels render reversed/illegible. This plugin (an ICU/WASM port)
  fixes the shaping. MapLibre loads it via `setRTLTextPlugin('/mapbox-gl-rtl-text.js')`.
- **Why a static file, not an npm import:** MapLibre loads it as a URL inside a
  web worker, so it must be served as a standalone file. We self‑host it (instead
  of a CDN) so there's no third‑party runtime dependency. It's lazy‑loaded — only
  fetched when Hebrew text is actually rendered.
- **License:** BSD‑2‑Clause. **Re‑vendor** by copying
  `node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js` here.

## Notes

- The RTL plugin is set globally, so it correctly shapes Hebrew labels on **all**
  basemaps (the OpenFreeMap dark/light styles show Hebrew names too).
- The satellite view has no labels of its own, so it's the only one that gets our
  custom bilingual (he/en) label overlay from `labels.ts`.
