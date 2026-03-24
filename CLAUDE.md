# BusRouter SG — Technical Notes

## Project
Singapore Bus Routes Explorer — interactive map.
Multi-entry-point build: main app + 1 mini-site (bus-arrival).

## Commands
```bash
npm start          # Dev server on :8888 (2 entry points)
npm run build      # Production build → ./dist/
npm run prod       # Serve dist/ locally
npm run test:e2e   # Playwright E2E tests (Chromium only)
```

## Tech Stack
- **Preact** (not React) — React compat alias in package.json; JSX pragma is `h` (see `.babelrc`)
- **MapLibre GL** — vector map rendering
- **Parcel 2** — bundler (not Vite/Webpack); custom transforms in `.parcelrc`
- **Workbox** — service worker with cache strategies (`service-worker.js`)
- **Fuse.js** — client-side fuzzy search
- **cheap-ruler** — fast geo calculations (preferred over full turf.js)
- All UI text is hardcoded English — i18n/localization has been removed

## Key Files
| File | Role |
|------|------|
| `assets/app.js` | Main app: map init, data loading, search, global `STORE` state |
| `assets/arrival.js` | Real-time bus arrival page logic |
| `assets/map-style.js` | MapLibre GL style configuration |
| `assets/components/` | Preact components (JSX) |
| `assets/utils/bus.js` | Service sort (alphanumeric), time formatting |
| `assets/utils/fetchCache.js` | Fetch wrapper with localStorage cache (24h TTL) |
| `assets/utils/getRoute.js` | URL hash router (parses `#/services/10`, `#/stops/12345`, etc.) |
| `assets/utils/specialID.js` | Stop ID encoding/decoding |
| `service-worker.js` | Workbox cache strategies |

## Data / APIs
- Static data: `https://data.busrouter.sg/v1/` → `routes.min.json`, `stops.min.json`, `services.min.json`
- Real-time arrivals: `https://arrivelah2.busrouter.sg`
- Local map tiles: `/tiles/` (PMTiles format)

## Geographic Data Model

### Coordinate system
All coordinates are `[longitude, latitude]` (GeoJSON order). `cheap-ruler` is instantiated once at lat 1.3 (Singapore) in `app.js` (line 51) and `BusServicesArrival.js` (line 4).

### Data files and in-memory shapes
| File | Raw format | In-memory shape |
|------|-----------|-----------------|
| `stops.min.json` | `{ stopNumber: [lng, lat, name] }` | `stopsData[number] = { name, number, coordinates: [lng, lat], services: [], routes: [], interchange, left }` |
| `services.min.json` | `{ service: { name, routes: [[stopNum, ...], ...] } }` | same; used to reverse-map stop → services |
| `routes.min.json` | `{ service: [encodedPolyline, ...] }` | decoded on-demand via `@mapbox/polyline.toGeoJSON()` → GeoJSON `LineString` |

- Each stop's `routes` array holds strings like `"10-0"` (service 10, direction 0).
- Route polylines follow actual roads, not stop-to-stop straight lines.

### Map sources (MapLibre GeoJSON)
| Source | Purpose |
|--------|---------|
| `'stops'` | All stops as `Point` features |
| `'routes'` | Active service polyline (with gradient + arrow layers) |
| `'routes-path'` | Hover-preview polylines for a service |
| `'routes-between'` | Polylines for the "between two stops" feature |

### Spatial queries
There is **no area/neighborhood query** (no bounding-box or polygon lookup). Spatial logic is stop-centric:
- `stopsData[stop].routes` → all services through a stop
- `findRoutesBetween()` (`app.js` ~line 1056) — intersects service lists for two stops
- `findNearestStops()` (`app.js` ~line 1113) — brute-force Euclidean scan of all stops
- `ruler.bearing()` — determines stop label side (left/right of road)
- `ruler.distance()` — walking distance between stops (threshold: meters, speed 1.4 m/s)
- `ruler.pointOnLine()` in `BusServicesArrival.js` — snaps live bus position to road geometry (within 10 m)

## Patterns
- **State**: Preact hooks for component state; global `STORE` object in `app.js` for shared state
- **Geo**: use `cheap-ruler` for distance/bearing, `turf` only for polygon ops
- **Caching**: `fetchCache.js` for API calls; Workbox for asset caching
- **Testing**: Playwright E2E in `tests/e2e/`; StopsList unit tests in `tests/StopsList/` (Vite)

## Config Files
| File | Purpose |
|------|---------|
| `.babelrc` | JSX pragma → `h` for Preact |
| `.parcelrc` | Custom transforms (SVG raw, JSON) |
| `playwright.config.js` | Chromium only, port 8888, auto-starts dev server |
| `.prettierrc` | 2-space indent, single quotes, trailing commas |
| `netlify.toml` | Deployment config and redirects |

## What Has Been Removed
- **Attribution control** — MapLibre `AttributionControl` removed from map
- **Ads** — BuySellAds integration (`assets/ad.js`, all `<Ad />` render sites, `window.optimize` scripts)
- **Visualization mini-site** — `visualization/` directory and entry point deleted entirely
- **About modal + logo button** — `assets/components/About.jsx`, `<header id="logo">` in `index.html`, all CSS
- **i18n / localization** — `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `@mapbox/mapbox-gl-language` all removed; `assets/i18n.js`, `i18n/*.json`, `crowdin.yml`, `assets/components/LocaleSelector.js` deleted; all `t()` calls replaced with hardcoded English strings
- **First/Last Bus mini-site** — `assets/firstlast.js`, `assets/firstlast.css`, `bus-first-last/` directory removed; `date-fns` dependency removed
