import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { checkRateLimit } from './utils/rateLimiter'
import { Env, Variables } from './types/env'

import authRoutes from './routes/auth'
import friendsRoutes from './routes/friends'
import notificationsRoutes from './routes/notifications'
import conversationsRoutes from './routes/conversations'
import presenceRoutes from './routes/presence'
import websocketRoutes from './routes/websocket'

// Re-export Durable Objects classes so Cloudflare Worker registers them
export { ConversationDO } from './durable-objects/ConversationDO'
export { UserPresenceDO } from './durable-objects/UserPresenceDO'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// Kích hoạt CORS cho tất cả các origins để Client di động và Web gọi được
app.use('*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Middleware chống DDoS (Rate limiting theo IP: Tối đa 60 requests/phút)
app.use('/api/*', async (c, next) => {
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
})

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'VivyChat OTP & Auth API (Cloudflare Worker)',
    version: '1.0.0'
  })
})

// Mount route modules
app.route('/api/auth', authRoutes)
app.route('/api', friendsRoutes)
app.route('/api/notifications', notificationsRoutes)
app.route('/api/conversations', conversationsRoutes)
app.route('/api/users/presence', presenceRoutes)
app.route('/ws', websocketRoutes)

export default app
