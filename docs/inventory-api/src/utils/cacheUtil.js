const store = new Map();

// ttlMs default: 5 minutes
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttlMs = 5 * 60 * 1000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs, cachedAt: new Date().toISOString() });
}

function invalidate(keyPrefix) {
  for (const k of store.keys()) {
    if (k.startsWith(keyPrefix)) store.delete(k);
  }
}

function getMetadata(key) {
  const entry = store.get(key);
  if (!entry) return null;
  return { cachedAt: entry.cachedAt, expiresAt: new Date(entry.expiresAt).toISOString() };
}

module.exports = { get, set, invalidate, getMetadata };
