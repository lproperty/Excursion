// generateStopAreas.js
// Reads data/planning-areas.geojson + fetches stops.min.json
// Outputs data/stops-areas.json: { stopNumber: "Planning Area Name", ... }

const fs = require('fs');
const path = require('path');
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');

const STOPS_URL = 'https://data.busrouter.sg/v1/stops.min.json';
const PLANNING_AREAS_PATH = path.join(__dirname, '../data/planning-areas.geojson');
const OUTPUT_PATH = path.join(__dirname, '../data/stops-areas.json');

// Try multiple known property key names for the area name
function getAreaName(properties) {
  return (
    properties.PLN_AREA_N ||
    properties.name ||
    properties.Name ||
    properties.PLANNING_AREA_NAME ||
    properties.Description ||
    null
  );
}

// Compute centroid of a polygon's outer ring
function polygonCentroid(coordinates) {
  const ring = coordinates[0];
  let x = 0, y = 0;
  for (const [lng, lat] of ring) {
    x += lng;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}

function getFeatureCentroid(feature) {
  const { type, coordinates } = feature.geometry;
  if (type === 'Polygon') {
    return polygonCentroid(coordinates);
  } else if (type === 'MultiPolygon') {
    // Use centroid of the largest polygon (by ring length)
    const largest = coordinates.reduce((a, b) => (a[0].length >= b[0].length ? a : b));
    return polygonCentroid(largest);
  }
  return null;
}

// Euclidean distance (degrees) — close enough for a 500m threshold at Singapore's lat
function dist2(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Roughly 500m in degrees at lat 1.3
const FALLBACK_THRESHOLD_DEG = 500 / 111320;

async function main() {
  if (!fs.existsSync(PLANNING_AREAS_PATH)) {
    console.error(`ERROR: ${PLANNING_AREAS_PATH} not found.`);
    console.error('Please place the Singapore planning areas GeoJSON at data/planning-areas.geojson');
    process.exit(1);
  }

  console.log('Reading planning areas...');
  const planningAreas = JSON.parse(fs.readFileSync(PLANNING_AREAS_PATH, 'utf8'));

  // Validate and extract area names
  const areas = planningAreas.features.map((f, i) => {
    const name = getAreaName(f.properties);
    if (!name) {
      console.warn(`WARNING: Feature ${i} has no recognisable name property. Properties: ${JSON.stringify(f.properties)}`);
    }
    return { name: name ? name.trim() : `Area ${i}`, feature: f };
  });

  console.log(`Loaded ${areas.length} planning areas.`);

  // Precompute centroids for fallback
  const centroids = areas.map(({ name, feature }) => ({
    name,
    centroid: getFeatureCentroid(feature),
  }));

  console.log('Fetching stops data...');
  const res = await fetch(STOPS_URL);
  if (!res.ok) throw new Error(`Failed to fetch stops: ${res.status}`);
  const rawStops = await res.json();

  const stopNumbers = Object.keys(rawStops);
  console.log(`Processing ${stopNumbers.length} stops...`);

  const result = {};
  let matched = 0;
  let fallback = 0;
  let unmatched = 0;

  for (const number of stopNumbers) {
    const [lng, lat] = rawStops[number];
    const pt = point([lng, lat]);

    let found = null;
    for (const { name, feature } of areas) {
      if (booleanPointInPolygon(pt, feature)) {
        found = name;
        break;
      }
    }

    if (found) {
      matched++;
      result[number] = found;
    } else {
      // Fallback: nearest centroid within threshold
      const coords = [lng, lat];
      let nearest = null;
      let nearestDist = Infinity;
      for (const { name, centroid } of centroids) {
        if (!centroid) continue;
        const d = dist2(coords, centroid);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = name;
        }
      }

      if (nearest && nearestDist <= FALLBACK_THRESHOLD_DEG) {
        fallback++;
        result[number] = nearest;
      } else {
        unmatched++;
        result[number] = null;
      }
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result));

  console.log(`\nDone.`);
  console.log(`  Total stops:       ${stopNumbers.length}`);
  console.log(`  Matched:           ${matched}`);
  console.log(`  Fallback assigned: ${fallback}`);
  console.log(`  Unmatched (null):  ${unmatched}`);
  console.log(`\nOutput written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
