# BusRouter SG — Technical Notes

## Project
Singapore Bus Routes Explorer — interactive map SPA at [busrouter.sg](https://busrouter.sg).
Multi-entry-point build: main app + 2 mini-sites (bus-arrival, bus-first-last).

## Commands
```bash
npm start          # Dev server on :8888 (all 3 entry points)
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
| `assets/firstlast.js` | First/last timing page logic |
| `assets/map-style.js` | MapLibre GL style configuration |
| `assets/components/` | Preact components (JSX) |
| `assets/utils/bus.js` | Service sort (alphanumeric), time formatting |
| `assets/utils/fetchCache.js` | Fetch wrapper with localStorage cache (24h TTL) |
| `assets/utils/getRoute.js` | Route lookup and processing |
| `assets/utils/specialID.js` | Stop ID encoding/decoding |
| `service-worker.js` | Workbox cache strategies |

## Data / APIs
- Static data: `https://data.busrouter.sg/v1/` → `routes.min.json`, `stops.min.json`, `services.min.json`
- Real-time arrivals: `https://arrivelah2.busrouter.sg`
- Local map tiles: `/tiles/` (PMTiles format)

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

## Bus Excursion Suggester (Planned Feature)

Ranks bus services at a stop by how interesting they'd be for a recreational ride.

### New Files
| File | Purpose |
|------|---------|
| `assets/data/planningAreas.js` | Static array of ~55 Singapore planning areas `{ name, centroid: [lng, lat], radius }` |
| `assets/utils/excursionScore.js` | Pure scoring module → `{ total: 0-100, breakdown }` |
| `assets/components/ExcursionBadge.jsx` | Score badge rendered inside service tags |
| `assets/components/ExcursionSettings.jsx` | Modal with planning area checklist |

### Modified Files
- `assets/components/BusServicesArrival.js` — Extract bus type (SD/DD/BD) from arrival API, accept `excursionMode`/`beenToAreas` props, re-sort by score, render badges
- `assets/app.js` — Add excursion state, toggle in stop popover `<h2>`, render settings modal, pass props to `BusServicesArrival`
- `assets/app.css` — Score badge styles (gold/green tiers), toggle, settings modal grid

### Scoring Algorithm (in `excursionScore.js`)
Data via `window._data` (exposed in `app.js`). Uses `cheap-ruler` + `@mapbox/polyline`.

| Criterion | Weight | Method |
|-----------|--------|--------|
| Novelty | 0.30 | Stops from current→terminal checked against planning area centroids. `100 * (1 - beenToTouched/totalTouched)` |
| Max distance from start | 0.25 | Farthest decoded polyline coord from origin. Normalize vs 25km |
| Double-decker | 0.10 | From arrival API: DD=100, BD=70, SD=30, unknown=50 |
| Endpoint spread | 0.15 | `ruler.distance(firstStop, lastStop)`. Normalize vs 20km |
| Stop density | 0.10 | `lineDistance / stopCount`. 1km avg gap = 100 |
| Loop factor | 0.10 | Bounding box spread + start/end geometry distance |

Direction selection: pick direction where current stop appears earliest (most remaining journey).

### UI
- **Toggle:** In stop popover `<h2>`: `[N services] · [First/Last bus ↗] · [🧭 Excursion ⚙]`
- **Service tags:** Re-sorted by score; gold border (75+), green (50-74); badge shows `★82`
- **Settings modal:** Planning area checkbox grid (2 cols), quick-select buttons (All/None/Common residential)

### Storage
- `busroutersg.excursion.beenTo` — JSON array of area names. Default: pre-populated with common residential areas (Toa Payoh, Ang Mo Kio, Bedok, Jurong East, Tampines, Woodlands, Clementi, Bishan, Hougang, Yishun)
- `busroutersg.excursion.enabled` — boolean, remembers toggle state
