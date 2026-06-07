import { Hono } from 'hono'
import { Env, Variables } from '../types/env'
import { authMiddleware } from '../middlewares/auth'

const conversations = new Hono<{ Bindings: Env; Variables: Variables }>()

// API: Tìm hoặc Tạo phòng chat 1-1 giữa 2 người dùng
conversations.post('/', authMiddleware, async (c) => {
  try {
    const { targetUserId } = await c.req.json<{ targetUserId: string }>()
    if (!targetUserId) {
      return c.json({ error: 'Target user ID is required.' }, 400)
    }

    const currentUser = c.get('user')
    if (currentUser.id === targetUserId) {
      return c.json({ error: 'Bạn không thể tạo cuộc trò chuyện với chính mình.' }, 400)
    }

    // 1. Kiểm tra xem cuộc hội thoại DIRECT đã tồn tại giữa 2 người chưa
    const existing = await c.env.DB.prepare(`
      SELECT cm1.conversation_id as id
      FROM conversation_members cm1
      JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
      JOIN conversations c ON cm1.conversation_id = c.id
      WHERE cm1.user_id = ? AND cm2.user_id = ? AND c.type = 'DIRECT'
    `).bind(currentUser.id, targetUserId).first<{ id: string }>()

    if (existing) {
      return c.json({ id: existing.id })
    }

    // 2. Nếu chưa, tạo cuộc trò chuyện mới
    const conversationId = crypto.randomUUID()
    const now = Date.now()

    await c.env.DB.prepare(
      'INSERT INTO conversations (id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(conversationId, null, 'DIRECT', now, now).run()

    // 3. Thêm cả 2 người dùng làm thành viên phòng chat
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)')
        .bind(conversationId, currentUser.id, 'OWNER', now),
      c.env.DB.prepare('INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)')
        .bind(conversationId, targetUserId, 'MEMBER', now)
    ])

    return c.json({ id: conversationId })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Lấy danh sách tin nhắn lịch sử của cuộc hội thoại (Cursor Pagination)
conversations.get('/:id/messages', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id') || ''
    const currentUser = c.get('user')

    // Gatekeeper check: Kiểm tra xem user hiện tại có phải là thành viên hội thoại không
    const membership = await c.env.DB.prepare(
      'SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?'
    ).bind(id, currentUser.id).first()

    if (!membership) {
      return c.json({ error: 'Bạn không có quyền truy cập lịch sử cuộc trò chuyện này.' }, 403)
    }

    const cursor = c.req.query('cursor')
    const beforeTime = cursor ? parseInt(cursor, 10) : Date.now()
    const limit = 50

    // Thực hiện truy vấn theo Cursor Pagination chuẩn với Index kết hợp
    const results = await c.env.DB.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? AND created_at < ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).bind(id, beforeTime, limit).all()

    const messages = results.results || []

    // Tải kèm tệp tin đính kèm
    if (messages.length > 0) {
      const msgIds = messages.map(m => `'${m.id}'`).join(',')
      const attResults = await c.env.DB.prepare(`
        SELECT * FROM attachments WHERE message_id IN (${msgIds})
      `).all()
      const attachments = attResults.results || []
      
      for (const msg of messages) {
        msg.attachments = attachments.filter((a: any) => a.message_id === msg.id)
      }
    }

    const nextCursor = messages.length === limit ? messages[messages.length - 1].created_at : null

    return c.json({
      messages,
      nextCursor
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default conversations
