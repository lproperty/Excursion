import CheapRuler from 'cheap-ruler';

import { sortServices } from './bus';

const ruler = new CheapRuler(1.3);

// Absolute distance scoring: 0–1 based on km thresholds
// 0 km → 0, 10 km → 0.5, 20+ km → 1.0
const absoluteDistanceScore = (km) => {
  if (!Number.isFinite(km) || km <= 0) return 0;
  return Math.min(km / 20, 1);
};

// Absolute area novelty scoring: raw novelty 0–1 is already meaningful
// 1/(count+1) averaged across areas: high when visit counts are low
const absoluteAreaScore = (rawNovelty) => {
  if (!Number.isFinite(rawNovelty) || rawNovelty <= 0) return 0;
  return Math.min(rawNovelty, 1);
};

export const getLevelLabel = (score) => {
  if (score >= 0.8) return 'Very high';
  if (score >= 0.6) return 'High';
  if (score >= 0.4) return 'Medium';
  if (score > 0) return 'Low';
  return 'Very low';
};

export const getVisitCount = (areaVisitCounts, area) => {
  const value = areaVisitCounts?.[area];
  return Number.isFinite(value) ? value : 0;
};

const getAreaNovelty = (areas, areaVisitCounts) => {
  if (!areas.length) return 0;
  const noveltySum = areas.reduce(
    (sum, area) => sum + 1 / (getVisitCount(areaVisitCounts, area) + 1),
    0,
  );
  return noveltySum / areas.length;
};

const getRouteSegments = (route, stopNumber) => {
  const segments = [];
  route.forEach((stop, index) => {
    if (stop !== stopNumber) return;
    const segment = route.slice(index);
    if (segment.length > 0) {
      segments.push(segment);
    }
  });
  return segments;
};

const getSegmentAreas = (segment, stopAreas, excludeArea) => {
  const areas = new Set();
  segment.forEach((stop) => {
    const area = stopAreas?.[stop];
    if (typeof area === 'string' && area.trim() && area !== excludeArea) {
      areas.add(area);
    }
  });
  return [...areas];
};

const compareInterestingEntries = (a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  return sortServices(a.service, b.service);
};

export function computeAreaInterestingness(areaVisitCounts) {
  if (!areaVisitCounts) return [];
  return Object.keys(areaVisitCounts)
    .map((area) => {
      const visitCount = getVisitCount(areaVisitCounts, area);
      const novelty = 1 / (visitCount + 1);
      const scorePct = Math.round(novelty * 100);
      const level = getLevelLabel(novelty);
      return { area, visitCount, novelty, scorePct, level };
    })
    .sort((a, b) => {
      if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
      return a.area.localeCompare(b.area);
    });
}

export function rankStopServicesByInterestingness({
  stopNumber,
  services,
  servicesData,
  stopsData,
  stopAreas,
  areaVisitCounts,
}) {
  const selectedStop = stopsData?.[stopNumber];
  if (!selectedStop || !Array.isArray(services) || !servicesData) {
    return (services || []).map((service) => ({
      service,
      score: 0,
      scorePct: 0,
      level: null,
      terminalStop: null,
      routeIndex: null,
      onwardAreas: [],
      onwardAreaCount: 0,
      distanceKm: 0,
      distanceScore: 0,
      areaScore: 0,
    }));
  }

  const currentArea = stopAreas?.[stopNumber];

  const rawEntries = services.map((service) => {
    const serviceData = servicesData[service];
    if (!serviceData?.routes?.length) {
      return {
        service,
        routeIndex: null,
        terminalStop: null,
        onwardAreas: [],
        onwardAreaCount: 0,
        distanceKm: 0,
        rawAreaNovelty: 0,
      };
    }

    const candidates = [];
    serviceData.routes.forEach((route, routeIndex) => {
      getRouteSegments(route, stopNumber).forEach((segment) => {
        const terminalStop = segment[segment.length - 1];

        // Fix issue 1: loop routes where terminal == current stop
        // Use the furthest intermediate stop for distance instead
        let distanceKm = 0;
        if (segment.length > 1) {
          if (terminalStop === stopNumber) {
            // Loop route — find the furthest intermediate stop
            let maxDist = 0;
            for (let i = 1; i < segment.length - 1; i++) {
              const coords = stopsData?.[segment[i]]?.coordinates;
              if (coords) {
                const d = ruler.distance(selectedStop.coordinates, coords);
                if (d > maxDist) maxDist = d;
              }
            }
            distanceKm = maxDist;
          } else {
            const terminalCoords = stopsData?.[terminalStop]?.coordinates;
            if (terminalCoords) {
              distanceKm = ruler.distance(
                selectedStop.coordinates,
                terminalCoords,
              );
            }
          }
        }

        // Fix issue 2: exclude the current stop's area from onward areas
        const onwardAreas = getSegmentAreas(segment, stopAreas, currentArea);
        const rawAreaNovelty = getAreaNovelty(onwardAreas, areaVisitCounts);
        candidates.push({
          service,
          routeIndex,
          terminalStop,
          onwardAreas,
          onwardAreaCount: onwardAreas.length,
          distanceKm,
          rawAreaNovelty,
        });
      });
    });

    if (!candidates.length) {
      return {
        service,
        routeIndex: null,
        terminalStop: null,
        onwardAreas: [],
        onwardAreaCount: 0,
        distanceKm: 0,
        rawAreaNovelty: 0,
      };
    }

    return candidates.reduce((best, current) => {
      if (current.distanceKm !== best.distanceKm) {
        return current.distanceKm > best.distanceKm ? current : best;
      }
      if (current.rawAreaNovelty !== best.rawAreaNovelty) {
        return current.rawAreaNovelty > best.rawAreaNovelty ? current : best;
      }
      return current.routeIndex < best.routeIndex ? current : best;
    });
  });

  // Fix issue 3: use absolute thresholds instead of relative min-max normalization
  // Area novelty is only meaningful when there's real visit history;
  // otherwise every unvisited area scores 1.0 and inflates everything.
  const hasVisitHistory =
    areaVisitCounts &&
    Object.values(areaVisitCounts).some((count) => count > 0);
  const useAreaScore = !!stopAreas && hasVisitHistory;

  return rawEntries
    .map((entry) => {
      const distanceScore = absoluteDistanceScore(entry.distanceKm);
      const areaScore = useAreaScore
        ? absoluteAreaScore(entry.rawAreaNovelty)
        : distanceScore; // when no area/visit data, score purely on distance
      const score = (distanceScore + areaScore) / 2;
      return {
        ...entry,
        distanceScore,
        areaScore,
        score,
        scorePct: Math.round(score * 100),
        level: getLevelLabel(score),
      };
    })
    .sort(compareInterestingEntries);
}
