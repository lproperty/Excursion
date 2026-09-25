import lscache from 'lscache';

// Copies are kept well past `timeout` so they can stand in when the network
// is down or crawling (on a bus, in an MRT tunnel)
const KEEP_STALE_MINUTES = 30 * 24 * 60;
// With a stale copy on hand, wait this long for the network before using it
const STALE_FALLBACK_MS = 5000;

const read = (url) => {
  const entry = lscache.get(url);
  if (entry?.fetchCache) return entry;
  // Written before fetch times were stored. lscache only returns entries that
  // are still within their original lifetime, so this one is fresh.
  return entry ? { time: Date.now(), data: entry } : null;
};

const fetchJSON = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
    return r.json();
  });

// Fetch JSON, cached in localStorage for `timeout` minutes. Falls back to an
// expired copy if the network fails or is slow, and only rejects when there
// is no copy at all.
export default (url, timeout) => {
  const cached = read(url);
  if (cached && Date.now() - cached.time < timeout * 60 * 1000) {
    return Promise.resolve(cached.data);
  }

  const request = fetchJSON(url).then((data) => {
    lscache.set(url, { fetchCache: 1, time: Date.now(), data }, KEEP_STALE_MINUTES);
    return data;
  });
  if (!cached) return request;

  // A slow request carries on in the background and refreshes the cache
  request.catch(() => {});
  const slow = new Promise((resolve) =>
    setTimeout(() => resolve(cached.data), STALE_FALLBACK_MS),
  );
  return Promise.race([request, slow]).catch(() => cached.data);
};
