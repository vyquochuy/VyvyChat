import { Context, Next } from 'hono'

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

// Middleware chống DDoS (Rate limiting theo IP: Tối đa 60 requests/phút)
export const rateLimitMiddleware = async (
  c: Context,
  next: Next
) => {
  if (c.req.method === 'OPTIONS') {
    return await next()
  }
  const clientIP = c.req.header('CF-Connecting-IP') || '127.0.0.1'
  const rateLimitKey = `rate:ip:${clientIP}`
  const isAllowed = await checkRateLimit(c.env.OTP_KV, rateLimitKey, 60, 60)
  if (!isAllowed) {
    return c.json({ error: 'Quá nhiều yêu cầu từ thiết bị của bạn. Vui lòng thử lại sau.' }, 429)
  }
  await next()
}