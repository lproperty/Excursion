// Returns the sorted list of unique planning area names a service passes through
export function getServiceAreas(service, servicesData, stopAreas) {
  const areas = new Set();
  const { routes } = servicesData[service];
  for (const route of routes) {
    for (const stop of route) {
      const area = stopAreas[stop];
      if (area) areas.add(area);
    }
  }
  return [...areas].sort();
}
