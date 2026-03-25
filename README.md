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
- Works as a PWA (add to home screen on iPhone/Android)

## Development

```bash
npm install
npm start        # Dev server on :8888
npm run build    # Production build → ./dist/
npm run test:e2e # Playwright E2E tests
```

## Credits

Forked from [BusRouter SG](https://github.com/cheeaun/busrouter-sg) by cheeaun.
