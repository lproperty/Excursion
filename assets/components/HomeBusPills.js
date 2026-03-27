import maplibregl from 'maplibre-gl';
import { setRafInterval, clearRafInterval } from '../utils/rafInterval';
import { findNearbyHomewardStops } from '../utils/homewardStops';

const ARRIVAL_URL = 'https://arrivelah2.busrouter.sg/?id=';
const POLL_INTERVAL = 15_000;
const ZOOM_THRESHOLD = 15;
const MAX_SERVICES_PER_PILL = 3;

function formatArrival(ms) {
  if (ms == null) return '...';
  const mins = Math.round(ms / 60_000);
  if (mins <= 0) return 'Arr';
  return mins + 'm';
}

function buildPillElement() {
  const el = document.createElement('div');
  el.className = 'home-bus-pill';
  return el;
}

// Render (or re-render) pill content sorted by arrival time.
// entries: [{ service, ms }] where ms may be null (unknown yet)
function renderPillContent(el, entries) {
  // Sort: known times ascending, unknowns last
  const sorted = [...entries].sort((a, b) => {
    if (a.ms == null && b.ms == null) return 0;
    if (a.ms == null) return 1;
    if (b.ms == null) return -1;
    return a.ms - b.ms;
  });

  const shown = sorted.slice(0, MAX_SERVICES_PER_PILL);
  const overflow = sorted.length - shown.length;

  el.innerHTML = '';
  for (const { service, ms } of shown) {
    const entry = document.createElement('span');
    entry.className = 'pill-entry';
    entry.dataset.service = service;
    entry.innerHTML = `<b>${service}</b> <span class="pill-time">${formatArrival(ms)}</span>`;
    el.appendChild(entry);
  }

  if (overflow > 0) {
    const more = document.createElement('span');
    more.className = 'pill-more';
    more.textContent = `+${overflow}`;
    el.appendChild(more);
  }
}

export default class HomeBusPills {
  constructor({ map, stopsDataArr, stopsData, servicesData, ruler }) {
    this._map = map;
    this._stopsDataArr = stopsDataArr;
    this._stopsData = stopsData;
    this._servicesData = servicesData;
    this._ruler = ruler;
    this._markers = new Map(); // stopNumber → { marker, element, homewardServices }
    this._intervalId = null;
    this._controller = null;
    this._zoomListener = null;
  }

  show(userLngLat) {
    // Clear any existing pills before showing fresh ones
    this.hide();

    const qualifiedStops = findNearbyHomewardStops(
      userLngLat,
      this._stopsDataArr,
      this._stopsData,
      this._servicesData,
      this._ruler,
    );

    if (qualifiedStops.length === 0) return;

    const currentZoom = this._map.getZoom();

    for (const { stop, homewardServices } of qualifiedStops) {
      const element = buildPillElement();
      renderPillContent(element, homewardServices.map(({ service }) => ({ service, ms: null })));
      if (currentZoom < ZOOM_THRESHOLD) {
        element.style.display = 'none';
      }

      const marker = new maplibregl.Marker({ element, anchor: 'bottom', offset: [0, -8] })
        .setLngLat(stop.coordinates)
        .addTo(this._map);

      this._markers.set(stop.number, { marker, element, homewardServices });
    }

    // Fetch immediately, then poll
    this._fetchArrivals();
    this._intervalId = setRafInterval(() => this._fetchArrivals(), POLL_INTERVAL);

    // Zoom-dependent visibility
    this._zoomListener = () => {
      const visible = this._map.getZoom() >= ZOOM_THRESHOLD;
      for (const { element } of this._markers.values()) {
        element.style.display = visible ? '' : 'none';
      }
    };
    this._map.on('zoom', this._zoomListener);
  }

  hide() {
    if (this._intervalId !== null) {
      clearRafInterval(this._intervalId);
      this._intervalId = null;
    }
    this._controller?.abort();
    this._controller = null;
    if (this._zoomListener) {
      this._map.off('zoom', this._zoomListener);
      this._zoomListener = null;
    }
    for (const { marker } of this._markers.values()) {
      marker.remove();
    }
    this._markers.clear();
  }

  destroy() {
    this.hide();
  }

  _fetchArrivals() {
    if (this._markers.size === 0) return;

    this._controller?.abort();
    this._controller = new AbortController();
    const { signal } = this._controller;

    const fetches = [...this._markers.entries()].map(
      ([stopNumber, { homewardServices, element }]) =>
        fetch(ARRIVAL_URL + stopNumber, { signal })
          .then((r) => r.json())
          .then((data) => {
            const arrivalMap = {};
            for (const svc of data.services || []) {
              const ms = svc.next?.duration_ms;
              if (ms != null) {
                // Keep shortest arrival if service appears more than once
                if (arrivalMap[svc.no] == null || ms < arrivalMap[svc.no]) {
                  arrivalMap[svc.no] = ms;
                }
              }
            }
            // Rebuild pill sorted by arrival time (soonest first)
            const entries = homewardServices.map(({ service }) => ({
              service,
              ms: arrivalMap[service] ?? null,
            }));
            renderPillContent(element, entries);
          })
          .catch(() => {}), // Silently ignore errors per stop
    );

    Promise.allSettled(fetches);
  }
}
