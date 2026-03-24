import { h } from 'preact';

export default function ArrivalTimeText({ ms }) {
  if (ms === null) return;
  const mins = Math.floor(ms / 1000 / 60);
  return mins <= 0 ? 'Arr' : `${mins}m`;
}
