// assets/js/core/db.js
import { cache } from './cache.js';

let _client = null;

export function initSupabase() {
  if (_client) return _client;
  if (typeof supabase === 'undefined') {
    console.error('Supabase library belum dimuat!');
    return null;
  }
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
    console.error('config.js belum dimuat!');
    return null;
  }
  _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

export function getSupabase() {
  return _client || initSupabase();
}

export async function withRetry(fn, maxRetries = 3, delayMs = 500) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err?.status >= 400 && err?.status < 500) throw err;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

export async function cachedQuery(key, queryFn, opts = {}) {
  return cache.fetch(key, async () => {
    const client = getSupabase();
    return withRetry(async () => {
      const result = await queryFn(client);
      if (result?.error) throw result.error;
      return result?.data ?? result;
    });
  }, opts);
}

export function invalidateCache(prefix) {
  if (prefix) cache.clearByPrefix(prefix);
  else cache.clearAll();
}