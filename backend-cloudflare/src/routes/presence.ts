import { Hono } from 'hono'
import { Env, Variables } from '../types/env'
import { authMiddleware } from '../middlewares/auth'

const presence = new Hono<{ Bindings: Env; Variables: Variables }>()

// API: Lấy trạng thái online/offline trực tiếp từ RAM của stubs UserPresenceDO
presence.get('/', authMiddleware, async (c) => {
  try {
    const userIdsParam = c.req.query('ids')
    if (!userIdsParam) {
      return c.json({})
    }

    const ids = userIdsParam.split(',')
    const statusMap: Record<string, { status: string; lastSeen?: number }> = {}

    await Promise.all(
      ids.map(async (id) => {
        const doId = c.env.USER_PRESENCE_DO.idFromName(id)
        const stub = c.env.USER_PRESENCE_DO.get(doId)
        try {
          // Gửi request nội bộ đến stub DO để lấy in-memory status
          const res = await stub.fetch(new Request('http://internal/status'))
          if (res.ok) {
            const data = await res.json() as { status: string; lastSeen?: number }
            statusMap[id] = data
          } else {
            statusMap[id] = { status: 'offline' }
          }
        } catch {
          statusMap[id] = { status: 'offline' }
        }
      })
    )

    return c.json(statusMap)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default presence
