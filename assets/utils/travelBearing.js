// How far (km) the route line may be from a stop to count as passing it
const MAX_LINE_DISTANCE = 0.05;
// How far (km) to look back and ahead along the route line when measuring the
// road's direction at the stop
const SMOOTHING_DISTANCE = 0.015;

/**
 * Compass bearing (degrees clockwise from north) a bus is travelling as it
 * serves a stop, following the road rather than the straight line to the
 * next stop.
 *
 * When a route runs both ways along the same road line (loops, out-and-back
 * routes), two passes are equally close to the stop. The pass heading towards
 * the next stop wins, and so does the pass with the stop on its left, since
 * Singapore drives on the left and buses pull in on the left.
 *
 * @param {[number, number]} stopCoords - [lng, lat]
 * @param {[number, number]} nextStopCoords - stop served after this one
 * @param {Array<[number, number]>|null} line - route polyline coordinates
 * @param {CheapRuler} ruler - pre-instantiated cheap-ruler (kilometres)
 * @returns {number}
 */
export default function getTravelBearing(
  stopCoords,
  nextStopCoords,
  line,
  ruler,
) {
  const nextStopBearing = ruler.bearing(stopCoords, nextStopCoords);
  if (!line) return nextStopBearing;

  let bestIndex = -1;
  let bestScore = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const distance = ruler.pointToSegmentDistance(stopCoords, a, b);
    if (distance > MAX_LINE_DISTANCE) continue;
    const turn = ((ruler.bearing(a, b) - nextStopBearing) * Math.PI) / 180;
    const stopOnLeft =
      (b[0] - a[0]) * (stopCoords[1] - a[1]) -
        (b[1] - a[1]) * (stopCoords[0] - a[0]) >
      0;
    // Penalise (in km) heading away from the next stop and passing with the
    // stop on the right
    const score =
      distance + 0.03 * (1 - Math.cos(turn)) + (stopOnLeft ? 0 : 0.02);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  if (bestIndex === -1) return nextStopBearing;

  const { point } = ruler.pointOnLine(
    [line[bestIndex], line[bestIndex + 1]],
    stopCoords,
  );
  const behind = ruler.along(
    [point, ...line.slice(0, bestIndex + 1).reverse()],
    SMOOTHING_DISTANCE,
  );
  const ahead = ruler.along(
    [point, ...line.slice(bestIndex + 1)],
    SMOOTHING_DISTANCE,
  );
  return ruler.bearing(behind, ahead);
}
