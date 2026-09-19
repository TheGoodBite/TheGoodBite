import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

function getRedis() {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    return await client.get<T>(key);
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds: number) {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch {
    // Cache failure should never break core app behavior.
  }
}

export async function getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>) {
  const cached = await getJson<T>(key);
  if (cached !== null) return cached;

  const value = await fetcher();
  await setJson(key, value, ttlSeconds);
  return value;
}

export async function incrementDailyCounter(key: string, ttlSeconds: number) {
  const client = getRedis();
  if (!client) return null;

  try {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, ttlSeconds);
    return count;
  } catch {
    return null;
  }
}

export async function incrementDailyCounterBy(key: string, amount: number, ttlSeconds: number) {
  const client = getRedis();
  if (!client) return null;

  try {
    const count = await client.incrby(key, amount);
    if (count === amount) await client.expire(key, ttlSeconds);
    return count;
  } catch {
    return null;
  }
}
