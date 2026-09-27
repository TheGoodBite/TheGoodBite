import { getRedis } from "@/lib/cache";

export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
export function setting(name: string, fallback: number, max = 10000) {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}
const localWindows = new Map<string, { time: number; amount: number }[]>();
const budgetScript = `
local now = redis.call('TIME')
local ms = tonumber(now[1])*1000 + math.floor(tonumber(now[2])/1000)
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ms-tonumber(ARGV[1]))
local count = redis.call('ZCARD',KEYS[1])
if count+tonumber(ARGV[3])>tonumber(ARGV[2]) then return 0 end
for i=1,tonumber(ARGV[3]) do redis.call('ZADD',KEYS[1],ms,ARGV[4]..':'..i) end
redis.call('PEXPIRE',KEYS[1],ARGV[1])
return 1`;
// Rolling windows, shared across instances in production. Never spend provider credits if the budget store is unavailable.
export async function reserveBudget(
  key: string,
  limit: number,
  windowMs: number,
  amount = 1,
) {
  const client = getRedis();
  if (client) {
    let allowed: number;
    try {
      allowed = await client.eval<unknown[], number>(
        budgetScript,
        [`budget:v1:${key}`],
        [windowMs, limit, amount, crypto.randomUUID()],
      );
    } catch {
      throw new ProviderError(
        "Search budget service is unavailable. Please try again shortly.",
      );
    }
    if (!allowed)
      throw new ProviderError(
        "Search request budget reached. Please try again later.",
        429,
      );
    return;
  }
  if (process.env.NODE_ENV === "production")
    throw new ProviderError(
      "Search requires the shared request-budget service to be configured.",
    );
  const now = Date.now();
  // Development only; bounded memory and no cross-process guarantee.
  for (const [id, entries] of localWindows)
    if (!entries.some((e) => e.time > now - 86400000)) localWindows.delete(id);
  if (localWindows.size > 1000)
    throw new ProviderError("Development search budget is full.", 429);
  const entries = (localWindows.get(key) ?? []).filter(
    (e) => e.time > now - windowMs,
  );
  if (entries.reduce((sum, e) => sum + e.amount, 0) + amount > limit)
    throw new ProviderError(
      "Search request budget reached. Please try again later.",
      429,
    );
  localWindows.set(key, [...entries, { time: now, amount }]);
}
export async function providerJson<T>(
  url: URL | string,
  provider: string,
  signal?: AbortSignal,
  timeoutMs = 6000,
): Promise<T> {
  signal?.throwIfAborted();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": `Meezany/0.1.0${process.env.PROVIDER_CONTACT_EMAIL ? ` (${process.env.PROVIDER_CONTACT_EMAIL})` : ""}`,
      },
    });
    if (!response.ok)
      throw new ProviderError(
        `${provider} ${response.status === 429 ? "is temporarily rate limited" : "is temporarily unavailable"}.`,
        response.status === 429 ? 429 : response.status === 404 ? 404 : 503,
      );
    return (await response.json()) as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      `${provider} did not respond in time. Please try again.`,
    );
  }
}
export async function mapConcurrent<T, R>(
  values: T[],
  limit: number,
  work: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        results[index] = await work(values[index], index);
      }
    }),
  );
  return results;
}
