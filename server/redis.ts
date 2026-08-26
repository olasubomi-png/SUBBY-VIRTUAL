import Redis from "ioredis";

let client: Redis | null = null;
const localFallback = new Map<string, { count: number; resetAt: number }>();

function getRedis() {
  if (!client && process.env.REDIS_URL)
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  return client;
}

export async function checkDistributedRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      return count <= limit;
    } catch {
      // Fail closed for mutation callers if Redis is configured but unavailable.
      return false;
    }
  }
  const now = Date.now();
  const current = localFallback.get(key);
  if (!current || current.resetAt <= now) {
    localFallback.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export async function closeRedis() {
  if (client) await client.quit();
  client = null;
}
