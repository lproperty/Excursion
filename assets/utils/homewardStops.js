export const HOME_STOPS = ['70261', '03019'];
export const HOME_STOP = HOME_STOPS[0];

/**
 * Find nearby stops that have at least one bus service heading toward any of HOME_STOPS.
 *
 * @param {[number, number]} userLngLat - [lng, lat]
 * @param {Array} stopsDataArr - all stops
 * @param {Object} stopsData - keyed by stop number (for coordinate lookups)
 * @param {Object} servicesData - keyed by service number
 * @param {CheapRuler} ruler - pre-instantiated cheap-ruler
 * @param {{ radiusKm?: number, maxStops?: number, homeStops?: string[], maxDeviationKm?: number }} options
 * @returns {Array<{ stop: Object, homewardServices: Array<{ service: string, routeIndex: number }> }>}
 */
export function findNearbyHomewardStops(
  userLngLat,
  stopsDataArr,
  stopsData,
  servicesData,
  ruler,
  options = {},
) {
  const {
    radiusKm = 0.5,
    maxStops = 8,
    homeStops = HOME_STOPS,
    maxDeviationKm = 2,
  } = options;

  // 1. Filter stops within radius, capture distance
  const nearby = [];
  for (let i = 0; i < stopsDataArr.length; i++) {
    const stop = stopsDataArr[i];
    const dist = ruler.distance(userLngLat, stop.coordinates);
    if (dist <= radiusKm) {
      nearby.push({ stop, dist });
    }
  }

  // 2. Sort by distance, cap
  nearby.sort((a, b) => a.dist - b.dist);
  const candidates = nearby.slice(0, maxStops);

  // 3. For each stop, find qualifying services (this stop appears before homeStop in route)
  const results = [];
  for (const { stop } of candidates) {
    const homewardServices = [];
    for (const routeId of stop.routes) {
      const dashIdx = routeId.indexOf('-');
      const service = routeId.slice(0, dashIdx);
      const routeIndex = parseInt(routeId.slice(dashIdx + 1), 10);
      const routeStops = servicesData[service]?.routes?.[routeIndex];
      if (!routeStops) continue;
      const nearbyIdx = routeStops.indexOf(stop.number);
      if (nearbyIdx === -1) continue;
      // Search for any home stop in the segment after the nearby stop,
      // so we only match occurrences the bus hasn't passed yet
      let homeIdx = -1;
      let matchedHomeStop = null;
      for (const hs of homeStops) {
        const idx = routeStops.indexOf(hs, nearbyIdx + 1);
        if (idx !== -1 && (homeIdx === -1 || idx < homeIdx)) {
          homeIdx = idx;
          matchedHomeStop = hs;
        }
      }
      if (homeIdx === -1) continue;

      const homeCoords = stopsData[matchedHomeStop]?.coordinates;

      // Skip if the route detours far from home before arriving —
      // catches loop routes going the long way and lollipop-shaped routes
      if (homeCoords) {
        let detours = false;
        for (let i = nearbyIdx + 1; i < homeIdx; i++) {
          const coords = stopsData[routeStops[i]]?.coordinates;
          if (coords && ruler.distance(coords, homeCoords) > maxDeviationKm) {
            detours = true;
            break;
          }
        }
        if (detours) continue;
      }

      // Collect terminal stops (endpoints) for this service across all route directions
      const serviceRoutes = servicesData[service]?.routes || [];
      const terminals = new Set();
      for (const r of serviceRoutes) {
        if (r.length > 0) {
          terminals.add(r[0]);
          terminals.add(r[r.length - 1]);
        }
      }

      // Skip if the bus reaches any terminal between the nearby stop and home —
      // that means it travels too far (to an endpoint) before getting home
      let passesTerminal = false;
      for (let i = nearbyIdx + 1; i < homeIdx; i++) {
        if (terminals.has(routeStops[i])) {
          passesTerminal = true;
          break;
        }
      }
      if (passesTerminal) continue;

      // Deduplicate: same service number may appear via both route directions
      if (!homewardServices.find((s) => s.service === service)) {
        homewardServices.push({ service, routeIndex });
      }
    }
    if (homewardServices.length > 0) {
      results.push({ stop, homewardServices });
    }
  }

  return results;
}
