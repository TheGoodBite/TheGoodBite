import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;
export function getRedis() {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis =
    url && token
      ? new Redis({
          url,
          token,
          retry: false,
          signal: () => AbortSignal.timeout(1500),
        })
      : null;
  return redis;
}
const memory = new Map<string, { value: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 500;
function remember(key: string, value: unknown, ttl: number) {
  if (memory.size >= MAX_ENTRIES) memory.delete(memory.keys().next().value!);
  memory.set(key, { value, expires: Date.now() + ttl * 1000 });
}
export async function getJson<T>(key: string): Promise<T | null> {
  const entry = memory.get(key);
  if (entry && entry.expires > Date.now()) return entry.value as T;
  memory.delete(key);
  try {
    return (await getRedis()?.get<T>(key)) ?? null;
  } catch {
    return null;
  }
}
export async function setJson(key: string, value: unknown, ttl: number) {
  remember(key, value, ttl);
  try {
    await getRedis()?.set(key, value, { ex: ttl });
  } catch {
    /* Reads can still use local cache. */
  }
}
// The envelope distinguishes a cached no-match from a cache miss. Errors never enter the cache.
export async function getOrSet<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const versioned = `v2:${key}`;
  const active = pending.get(versioned);
  if (active) return active as Promise<T>;
  const task = (async () => {
    const cached = await getJson<{ value: T }>(versioned);
    if (cached) return cached.value;
    const value = await fetcher();
    await setJson(
      versioned,
      { value },
      value === null || (Array.isArray(value) && !value.length)
        ? Math.min(ttl, 300)
        : ttl,
    );
    return value;
  })();
  pending.set(versioned, task);
  try {
    return await task;
  } finally {
    pending.delete(versioned);
  }
}
export async function incrementDailyCounterBy(
  key: string,
  amount: number,
  ttl: number,
) {
  try {
    const client = getRedis();
    if (!client) return null;
    return await client.eval<unknown[], number>(
      `local n=redis.call('INCRBY',KEYS[1],ARGV[1]); if n==tonumber(ARGV[1]) then redis.call('EXPIRE',KEYS[1],ARGV[2]) end; return n`,
      [key],
      [amount, ttl],
    );
  } catch {
    return null;
  }
}
export const incrementDailyCounter = (key: string, ttl: number) =>
  incrementDailyCounterBy(key, 1, ttl);
