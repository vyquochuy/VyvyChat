import { Hono } from 'hono'
import { Env, Variables } from '../types/env'
import { authMiddleware } from '../middlewares/auth'

const notifications = new Hono<{ Bindings: Env; Variables: Variables }>()

// API: Lấy danh sách thông báo của người dùng
notifications.get('/', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user')

    const result = await c.env.DB.prepare(
      'SELECT id, title, body, is_read, type, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(currentUser.id).all().then(r => r.results)

    return c.json(result)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Đánh dấu thông báo là đã đọc
notifications.post('/:id/read', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const currentUser = c.get('user')

    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
    ).bind(id, currentUser.id).run()

    return c.json({ message: 'Đã đánh dấu thông báo là đã đọc.' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default notifications
