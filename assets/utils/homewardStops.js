export const HOME_STOP = '70261';

/**
 * Find nearby stops that have at least one bus service heading toward HOME_STOP.
 *
 * @param {[number, number]} userLngLat - [lng, lat]
 * @param {Array} stopsDataArr - all stops
 * @param {Object} servicesData - keyed by service number
 * @param {CheapRuler} ruler - pre-instantiated cheap-ruler
 * @param {{ radiusKm?: number, maxStops?: number, homeStop?: string }} options
 * @returns {Array<{ stop: Object, homewardServices: Array<{ service: string, routeIndex: number }> }>}
 */
export function findNearbyHomewardStops(
  userLngLat,
  stopsDataArr,
  servicesData,
  ruler,
  options = {},
) {
  const { radiusKm = 0.5, maxStops = 8, homeStop = HOME_STOP } = options;

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
      const homeIdx = routeStops.indexOf(homeStop);
      if (nearbyIdx !== -1 && homeIdx !== -1 && nearbyIdx < homeIdx) {
        // Deduplicate: same service number may appear via both route directions
        if (!homewardServices.find((s) => s.service === service)) {
          homewardServices.push({ service, routeIndex });
        }
      }
    }
    if (homewardServices.length > 0) {
      results.push({ stop, homewardServices });
    }
  }

  return results;
}
