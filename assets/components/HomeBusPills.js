import maplibregl from 'maplibre-gl';
import { setRafInterval, clearRafInterval } from '../utils/rafInterval';
import { findNearbyHomewardStops } from '../utils/homewardStops';

const ARRIVAL_URL = 'https://arrivelah2.busrouter.sg/?id=';
const POLL_INTERVAL = 20_000;
const ZOOM_THRESHOLD = 15;
const MAX_SERVICES_PER_PILL = 3;

function formatArrival(ms) {
  if (ms == null) return '...';
  const mins = Math.round(ms / 60_000);
  if (mins <= 0) return 'Arr';
  return mins + 'm';
}

function buildPillElement(homewardServices) {
  const el = document.createElement('div');
  el.className = 'home-bus-pill';

  const shown = homewardServices.slice(0, MAX_SERVICES_PER_PILL);
  const overflow = homewardServices.length - shown.length;

  for (const { service } of shown) {
    const entry = document.createElement('span');
    entry.className = 'pill-entry';
    entry.dataset.service = service;
    entry.innerHTML = `<b>${service}</b> <span class="pill-time">...</span>`;
    el.appendChild(entry);
  }

  if (overflow > 0) {
    const more = document.createElement('span');
    more.className = 'pill-more';
    more.textContent = `+${overflow}`;
    el.appendChild(more);
  }

  return el;
}

export default class HomeBusPills {
  constructor({ map, stopsDataArr, servicesData, ruler }) {
    this._map = map;
    this._stopsDataArr = stopsDataArr;
    this._servicesData = servicesData;
    this._ruler = ruler;
    this._markers = new Map(); // stopNumber → { marker, element, homewardServices }
    this._intervalId = null;
    this._controller = null;
    this._zoomListener = null;
  }

  show(userLngLat) {
    const qualifiedStops = findNearbyHomewardStops(
      userLngLat,
      this._stopsDataArr,
      this._servicesData,
      this._ruler,
    );

    if (qualifiedStops.length === 0) return;

    const currentZoom = this._map.getZoom();

    for (const { stop, homewardServices } of qualifiedStops) {
      const element = buildPillElement(homewardServices);
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
            // Update each pill entry
            const entries = element.querySelectorAll('.pill-entry');
            for (const entry of entries) {
              const svcNo = entry.dataset.service;
              const timeEl = entry.querySelector('.pill-time');
              if (timeEl) {
                timeEl.textContent = formatArrival(arrivalMap[svcNo]);
              }
            }
          })
          .catch(() => {}), // Silently ignore errors per stop
    );

    Promise.allSettled(fetches);
  }
}
