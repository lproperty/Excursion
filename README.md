# Anti-coma Excursion

An interactive Singapore bus routes explorer, built for spontaneous bus-surfing adventures.

Search for a bus stop, see which services pass through, and pick one ranked by how far it goes and how many new areas it'll take you through.

Live at: **https://lproperty.github.io/Excursion/**

## Features

- Browse all Singapore bus stops and routes on an interactive map
- Real-time bus arrival times
- **Interestingness ranking** — services scored by distance and area novelty, so you can find a good excursion at a glance
- Search for bus services, stops, or planning areas
- Click a planning area to zoom the map to it
- Zooms to your current location on first load
- **Home bus pills** — on PWA open, nearby stops automatically show floating arrival-time bubbles for buses heading to a configured home stop, sorted by soonest arrival
- Origin stop clearly marked when viewing a route from a stop
- Works as a PWA (add to home screen on iPhone/Android)

## Development

```bash
npm install
npm start       # Dev server on :8888
npm run build   # Production build → ./dist/
```

## Credits

Forked from [BusRouter SG](https://github.com/cheeaun/busrouter-sg) by cheeaun.
