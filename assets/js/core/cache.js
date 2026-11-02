// assets/js/core/cache.js
const CACHE_PREFIX = 'tb_';
const CACHE_VERSION = 'v1';
const DEFAULT_TTL = 24 * 60 * 60 * 1000;
const MAX_BYTES = 4.5 * 1024 * 1024;

function _key(key) {
  return `${CACHE_PREFIX}${CACHE_VERSION}_${key}`;
}

function _getUserId() {
  try {
    const raw = sessionStorage.getItem('active_role');
    if (!raw) return 'anon';
    const parsed = JSON.parse(raw);
    return parsed?.user_id || 'anon';
  } catch { return 'anon'; }
}

function _getSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

const cache = {
  set(key, data, ttl = DEFAULT_TTL) {
    const userKey = _key(`${_getUserId()}_${key}`);
    const payload = { d: data, e: Date.now() + ttl, t: Date.now() };
    try {
      localStorage.setItem(userKey, JSON.stringify(payload));
      return true;
    } catch (err) {
      this.evictOldest();
      try {
        localStorage.setItem(userKey, JSON.stringify(payload));
        return true;
      } catch (err2) {
        return false;
      }
    }
  },

  get(key) {
    const userKey = _key(`${_getUserId()}_${key}`);
    try {
      const raw = localStorage.getItem(userKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.e !== 'number') {
        localStorage.removeItem(userKey);
        return null;
      }
      if (Date.now() > parsed.e) {
        localStorage.removeItem(userKey);
        return null;
      }
      return parsed.d;
    } catch { return null; }
  },

  has(key) {
    return this.get(key) !== null;
  },

  remove(key) {
    localStorage.removeItem(_key(`${_getUserId()}_${key}`));
  },

  clearAll() {
    const userPrefix = _key(`${_getUserId()}_`);
    Object.keys(localStorage)
      .filter(k => k.startsWith(userPrefix))
      .forEach(k => localStorage.removeItem(k));
  },

  clearByPrefix(prefix) {
    const userPrefix = _key(`${_getUserId()}_${prefix}`);
    Object.keys(localStorage)
      .filter(k => k.startsWith(userPrefix))
      .forEach(k => localStorage.removeItem(k));
  },

  clearEverything() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },

  evictOldest() {
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    if (allKeys.length === 0) return;
    const entries = [];
    for (const k of allKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        entries.push({ key: k, exp: parsed.e || 0, size: raw.length });
      } catch {}
    }
    entries.sort((a, b) => a.exp - b.exp || b.size - a.size);
    const toDelete = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toDelete && i < entries.length; i++) {
      localStorage.removeItem(entries[i].key);
    }
  },

  getStats() {
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    const userPrefix = _key(`${_getUserId()}_`);
    const userKeys = allKeys.filter(k => k.startsWith(userPrefix));
    let totalSize = 0, userSize = 0;
    for (const k of allKeys) {
      const size = (localStorage.getItem(k) || '').length * 2;
      totalSize += size;
      if (k.startsWith(userPrefix)) userSize += size;
    }
    return {
      totalKeys: allKeys.length,
      userKeys: userKeys.length,
      totalSize: _getSize(totalSize),
      userSize: _getSize(userSize),
      maxBytes: _getSize(MAX_BYTES),
      percentUsed: ((totalSize / MAX_BYTES) * 100).toFixed(1) + '%'
    };
  },

  async fetch(key, fetcher, opts = {}) {
    const { ttl = DEFAULT_TTL, forceRefresh = false } = opts;
    if (!forceRefresh) {
      const cached = this.get(key);
      if (cached !== null) return cached;
    }
    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }
};

// expose global (bukan ES module)
if (typeof window !== 'undefined') {
  window.tbCache = cache;
  window.TB_DEFAULT_TTL = DEFAULT_TTL;
}