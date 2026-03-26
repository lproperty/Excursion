import { h } from 'preact';
import { getVisitCount } from '../utils/interesting';

function visitLabel(count) {
  if (count === 0) return 'Unvisited';
  if (count === 1) return '1 visit';
  return `${count} visits`;
}

function chipClass(count) {
  if (count <= 1) return 'area-chip novel';
  if (count <= 5) return 'area-chip moderate';
  return 'area-chip familiar';
}

export default function ServiceInterestingness({
  entry,
  areaVisitCounts,
  stopsData,
}) {
  if (!entry || !entry.scorePct) return null;

  const {
    originStop,
    originStopName,
    distanceScore,
    areaScore,
    distanceKm,
    terminalStop,
    onwardAreas,
    scorePct,
    level,
  } = entry;

  const terminalName = stopsData?.[terminalStop]?.name;
  const distancePct = Math.round((distanceScore || 0) * 100);
  const noveltyPct = Math.round((areaScore || 0) * 100);

  return (
    <div class="service-interestingness">
      <div class="si-header">
        <span
          class={`area-level area-level-${level.toLowerCase().replace(' ', '-')}`}
        >
          {level} {scorePct}
        </span>
        <span class="si-origin">
          from <b class="mini-stop-tag">{originStop}</b>{' '}
          {originStopName}
        </span>
      </div>

      <div class="score-breakdown">
        <div class="score-component">
          <div class="score-bar-label">
            <span>Distance</span>
            <span class="score-value">{distancePct}</span>
          </div>
          <div class="score-bar">
            <div
              class="score-bar-fill distance"
              style={{ width: `${distancePct}%` }}
            />
          </div>
          <div class="score-detail">
            {distanceKm > 0
              ? `${distanceKm.toFixed(1)} km${terminalName ? ` to ${terminalName}` : ''}`
              : 'Same area'}
          </div>
        </div>
        <div class="score-component">
          <div class="score-bar-label">
            <span>Area novelty</span>
            <span class="score-value">{noveltyPct}</span>
          </div>
          <div class="score-bar">
            <div
              class="score-bar-fill novelty"
              style={{ width: `${noveltyPct}%` }}
            />
          </div>
          <div class="score-detail">
            {onwardAreas?.length
              ? `${onwardAreas.length} area${onwardAreas.length !== 1 ? 's' : ''} ahead`
              : 'No new areas'}
          </div>
        </div>
      </div>

      {onwardAreas?.length > 0 && (
        <div class="onward-areas">
          {onwardAreas.map((area) => {
            const count = getVisitCount(areaVisitCounts, area);
            return (
              <span key={area} class={chipClass(count)} title={visitLabel(count)}>
                {area}
                <span class="chip-visits">{count}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
