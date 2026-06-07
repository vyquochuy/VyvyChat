import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { rateLimitMiddleware } from './utils/rateLimiter'
import { Env, Variables } from './types/env'
import { queueConsumer } from './queue'

import authRoutes from './routes/auth'
import friendsRoutes from './routes/friends'
import notificationsRoutes from './routes/notifications'
import conversationsRoutes from './routes/conversations'
import presenceRoutes from './routes/presence'
import websocketRoutes from './routes/websocket'
import mediaRoutes from './routes/media'

// Re-export Durable Objects classes so Cloudflare Worker registers them
export { ConversationDO } from './durable-objects/ConversationDO'
export { UserPresenceDO } from './durable-objects/UserPresenceDO'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// 1. Kích hoạt CORS cho tất cả các origins (BẮT BUỘC ĐẶT TRƯỚC MOUNT ROUTES)
app.use('*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// 2. Middleware chống DDoS rate limit (BẮT BUỘC ĐẶT TRƯỚC MOUNT ROUTES)
app.use('/api/*', rateLimitMiddleware)

// 3. Mount route modules
app.route('/api/auth', authRoutes)
app.route('/api', friendsRoutes)
app.route('/api/notifications', notificationsRoutes)
app.route('/api/conversations', conversationsRoutes)
app.route('/api/users/presence', presenceRoutes)
app.route('/api/media', mediaRoutes)
app.route('/ws', websocketRoutes)

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'VivyChat OTP & Auth API (Cloudflare Worker)',
    version: '1.0.0'
  })
})

export default {
  fetch: app.fetch,
  queue: queueConsumer
}
