import { h } from 'preact';

export default function AreaInterestingness({ areas, onAreaClick }) {
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
            <span class="area-visits">{visitCount} visit{visitCount !== 1 ? 's' : ''}</span>
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
