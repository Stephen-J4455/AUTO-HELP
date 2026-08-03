import { supabase } from '../supabase/supabase';

const SUPABASE_URL = (supabase as any).supabaseUrl as string;

// ---------------------------------------------------------------------------
// Upstash Redis cache layer.
//
// We talk to Upstash's REST API directly with `fetch` so we don't need to add
// a native dependency. The credentials are NOT stored in the public
// `store_settings` table or shipped to the client — they live as edge-function
// secrets (UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN) and are handed to
// the app once via the `cache-config` edge function, then cached in-memory.
//
// Any failure is swallowed — the app always falls back to live Supabase queries,
// so the cache is a pure performance optimisation and never breaks the UI.
//
// Upstash usage is currently DISABLED (CACHE_ENABLED = false): the app never
// calls the `cache-config` edge function and never talks to Upstash. Set this
// to true (and configure the edge-function secrets) to re-enable caching.
// ---------------------------------------------------------------------------

export const CACHE_ENABLED = false;

export type CacheCredentials = {
  url: string | null;
  token: string | null;
};

let cachedCreds: CacheCredentials | null = null;
let credsPromise: Promise<CacheCredentials> | null = null;

async function getCredentials(): Promise<CacheCredentials> {
  if (!CACHE_ENABLED) return { url: null, token: null };
  if (cachedCreds) return cachedCreds;
  if (credsPromise) return credsPromise;

  const anonKey = (supabase as any).supabaseKey as string;
  credsPromise = (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cache-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('cache-config failed');
      const json = (await res.json()) as { url?: string | null; token?: string | null };
      cachedCreds = { url: json.url || null, token: json.token || null };
    } catch {
      // No cache configured / unreachable — disable caching.
      cachedCreds = { url: null, token: null };
    }
    return cachedCreds;
  })();

  return credsPromise;
}

async function rest<T>(path: string, body?: unknown): Promise<T | null> {
  const { url, token } = await getCredentials();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return (json.result ?? null) as T | null;
  } catch {
    return null;
  }
}

const DEFAULT_TTL_SECONDS = 5 * 60; // 5 minutes

/** Returns cached JSON value, or null on miss/error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await rest<string>(`get/${encodeURIComponent(key)}`);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Stores a JSON-serialisable value with a TTL in seconds. */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const payload = JSON.stringify(value);
  // Upstash: POST /set/<key> with body = value, then /expire/<key>/<ttl>
  await rest(`set/${encodeURIComponent(key)}`, payload);
  await rest(`expire/${encodeURIComponent(key)}/${ttlSeconds}`, '');
}

/**
 * Reads through the cache: returns the cached value if present, otherwise calls
 * `fetcher`, stores the result and returns it. Never throws — on any cache
 * error it falls back to `fetcher`.
 */
export async function cacheReadThrough<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  try {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;
  } catch {
    // ignore, fall through
  }
  const fresh = await fetcher();
  // Best-effort write; do not await so a slow cache never blocks the UI.
  void cacheSet(key, fresh, ttlSeconds).catch(() => {});
  return fresh;
}