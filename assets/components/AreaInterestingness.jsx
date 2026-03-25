import { h } from 'preact';

export default function AreaInterestingness({ areas, onAreaClick, onVisitCountChange }) {
  if (!areas || !areas.length) return <p>No area data available.</p>;
  return (
    <ul class="area-list">
      {areas.map(({ area, visitCount, scorePct, level }) => (
        <li
          key={area}
          class={`area-item${onAreaClick ? ' area-item-clickable' : ''}`}
          onClick={onAreaClick ? () => onAreaClick(area) : undefined}
        >
          <span class="area-name">{area}</span>
          <span class="area-stats">
            {onVisitCountChange && (
              <span class="visit-controls">
                <button
                  class="visit-btn"
                  disabled={visitCount === 0}
                  onClick={(e) => { e.stopPropagation(); onVisitCountChange(area, -1); }}
                >−</button>
                <span class="area-visits">{visitCount}</span>
                <button
                  class="visit-btn"
                  onClick={(e) => { e.stopPropagation(); onVisitCountChange(area, 1); }}
                >+</button>
              </span>
            )}
            <span
              class={`area-level area-level-${level.toLowerCase().replace(' ', '-')}`}
            >
              {level} {scorePct}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
