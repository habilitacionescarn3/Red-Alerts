# Red Alerts - Client

A public, no-auth React app for Israel's live rocket / hostile-aircraft alerts,
modeled on tzevaadom.co.il. It is built around an interactive **MapLibre** map of
Israel that highlights alert areas in real time, with a 24-hour event feed and an
analytics page.

## Stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (new-york)
- **react-router-dom v7** with path-based i18n (`/:lng`) and RTL (Hebrew default)
- **react-i18next** (he / en)
- **@tanstack/react-query** for the read-only alerts API
- **zustand** for realtime + selection state
- **maplibre-gl** for the map (keyless CARTO raster basemap)
- **AWS IoT over MQTT/WSS** (Cognito unauth creds + SigV4) for live pushes,
  with an automatic API-polling fallback

## Getting started

```bash
npm install
npm run dev
```

There are **no environment variables and no secrets** in the frontend. The API
base URL is derived from the current origin: on `localhost` it targets
`http://localhost:8000/api` (the local backend), otherwise `<origin>/api`
(CloudFront -> API Gateway). The (non-secret) AWS IoT values live as plain
constants in `src/lib/realtime/config.ts`.

Build / lint:

```bash
npm run build
npm run lint
```

## Project layout

```
src/
  api/          axios instance + alerts service + React Query hooks
  components/
    ui/         shadcn components
    shared/     navbar, footer, toaster, theme + language switchers, metadata
    layouts/    AppLayout (navbar + content)
    map/        MapLibre AlertMap + basemap style
    pages/      home/ (feed, banner) and analytics/ (stat cards)
  data/         app metadata, tunable CONFIG, category metadata
  hooks/        useLanguage, useAlertEvents (server + live merge)
  i18n/         config + he/en translation modules
  lib/
    geo/        Hebrew city centroids, name normalization, polygon builder
    realtime/   AWS IoT module: config, SigV4 signer, MQTT client, useLiveAlerts
    analytics.ts, time.ts, utils.ts
  pages/        HomePage, AnalyticsPage, NotFoundPage
  router/       routes, LanguageLayout, RootRedirect, router
  store/        zustand alerts store
  types/        alerts + geo contracts
```

## Realtime / AWS IoT

Browsers get temporary AWS credentials from a Cognito **unauthenticated** identity
pool and subscribe to the IoT broadcast topic over MQTT-over-WSS (SigV4 signed).
Configure the (non-secret) values as constants in `src/lib/realtime/config.ts`:

- `IDENTITY_POOL_ID` -> CDK output `IdentityPoolId`
- `TOPIC` -> CDK output `IotBroadcastTopic` (e.g. `red-alerts-prod-alerts`)
- `ENDPOINT` -> `aws iot describe-endpoint --endpoint-type iot:Data-ATS`

When `ENDPOINT` / `IDENTITY_POOL_ID` are blank the app marks the connection as
"polling" and relies on React Query's interval to keep the map and feed fresh.

## Notes / follow-ups

- The backend stores only city **names** (no coordinates), so the client ships a
  curated Hebrew city -> centroid dataset (`src/lib/geo/cityCentroids.ts`) and
  draws approximate polygon areas. Extend that file (or swap in a fuller Oref
  polygon GeoJSON) to widen map coverage. Areas without geo data still appear in
  the feed and analytics and surface a small "not shown on map" notice.
