import { Hono } from 'hono'
import { Env, Variables } from '../types/env'
import { authMiddleware } from '../middlewares/auth'

const websocket = new Hono<{ Bindings: Env; Variables: Variables }>()

// WebSocket: Kết nối phòng chat (Conversation DO Upgrade)
websocket.get('/conversation/:id', authMiddleware, async (c) => {
  const id = c.req.param('id') || ''
  const currentUser = c.get('user')

  // Gatekeeper check: Đảm bảo user thực sự thuộc nhóm chat
  const membership = await c.env.DB.prepare(
    'SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?'
  ).bind(id, currentUser.id).first()

  if (!membership) {
    return c.json({ error: 'Không có quyền truy cập.' }, 403)
  }

  // Khởi tạo stub kết nối đến ConversationDO
  const doId = c.env.CONVERSATION_DO.idFromName(id)
  const stub = c.env.CONVERSATION_DO.get(doId)

  // Forward request đến DO và đính kèm custom headers xác thực danh tính
  const newHeaders = new Headers(c.req.raw.headers)
  newHeaders.set('Upgrade', 'websocket')
  newHeaders.set('X-User-Id', currentUser.id)

  const request = new Request(`http://internal/ws/conversation/${id}`, {
    headers: newHeaders
  })

  return stub.fetch(request)
})

// WebSocket: Kết nối theo dõi Presence toàn cục (UserPresence DO Upgrade)
websocket.get('/presence', authMiddleware, async (c) => {
  const currentUser = c.get('user')

  const doId = c.env.USER_PRESENCE_DO.idFromName(currentUser.id)
  const stub = c.env.USER_PRESENCE_DO.get(doId)

  const newHeaders = new Headers(c.req.raw.headers)
  newHeaders.set('Upgrade', 'websocket')
  newHeaders.set('X-User-Id', currentUser.id)

  const request = new Request('http://internal/ws/presence', {
    headers: newHeaders
  })

  return stub.fetch(request)
})

export default websocket
