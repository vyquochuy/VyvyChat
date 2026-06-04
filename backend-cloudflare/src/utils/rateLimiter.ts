export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  durationSeconds: number
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - durationSeconds * 1000;

  // Retrieve existing timestamps
  const data = await kv.get(key);
  let timestamps: number[] = [];

  if (data) {
    try {
      timestamps = JSON.parse(data);
    } catch {
      timestamps = [];
    }
  }

  // Filter out expired timestamps
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= limit) {
    return false;
  }

  // Add current timestamp and save back to KV
  timestamps.push(now);
  
  // Set KV expiration to clean up keys (minimum 60 seconds for Cloudflare KV)
  await kv.put(key, JSON.stringify(timestamps), {
    expirationTtl: Math.max(durationSeconds, 60),
  });

  return true;
}
