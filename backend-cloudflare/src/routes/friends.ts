import { Hono } from 'hono'
import { Env, Variables } from '../types/env'
import { authMiddleware } from '../middlewares/auth'

const friends = new Hono<{ Bindings: Env; Variables: Variables }>()

// API: Tìm kiếm người dùng bằng UID, Email hoặc Tên hiển thị
friends.get('/users/search', authMiddleware, async (c) => {
  const query = c.req.query('query')?.trim()
  if (!query) {
    return c.json([])
  }

  const currentUser = c.get('user')

  let users: any[] = []
  if (/^\d+$/.test(query)) {
    const uidVal = parseInt(query, 10)
    users = await c.env.DB.prepare(
      'SELECT id, display_name, email, uid, avatar_url, bio, public_key, key_version FROM users WHERE uid = ? AND id != ?'
    ).bind(uidVal, currentUser.id).all().then(r => r.results)
  } else if (query.includes('@')) {
    users = await c.env.DB.prepare(
      'SELECT id, display_name, email, uid, avatar_url, bio, public_key, key_version FROM users WHERE email = ? AND id != ?'
    ).bind(query.toLowerCase(), currentUser.id).all().then(r => r.results)
  } else {
    users = await c.env.DB.prepare(
      'SELECT id, display_name, email, uid, avatar_url, bio, public_key, key_version FROM users WHERE display_name LIKE ? AND id != ? LIMIT 20'
    ).bind(`%${query}%`, currentUser.id).all().then(r => r.results)
  }

  const populatedUsers = await Promise.all(users.map(async (u) => {
    const friendship = await c.env.DB.prepare(
      'SELECT * FROM friendships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)'
    ).bind(currentUser.id, u.id, u.id, currentUser.id).first<{
      id: string
      user_id_1: string
      user_id_2: string
      status: string
    }>()

    let relationStatus = 'NONE'
    if (friendship) {
      if (friendship.status === 'ACCEPTED') {
        relationStatus = 'ACCEPTED'
      } else if (friendship.status === 'PENDING') {
        if (friendship.user_id_1 === currentUser.id) {
          relationStatus = 'PENDING_SENT'
        } else {
          relationStatus = 'PENDING_RECEIVED'
        }
      } else if (friendship.status === 'BLOCKED') {
        relationStatus = 'BLOCKED'
      }
    }

    return {
      id: u.id,
      displayName: u.display_name,
      email: u.email,
      uid: u.uid,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      relationStatus,
      publicKey: (u as any).public_key || null,
      keyVersion: (u as any).key_version ?? 1
    }
  }))

  return c.json(populatedUsers)
})

// API: Gửi lời mời kết bạn (hoặc tự động Chấp nhận nếu đối phương đã gửi trước đó)
friends.post('/friends/request', authMiddleware, async (c) => {
  try {
    const { targetUserId } = await c.req.json<{ targetUserId: string }>()
    if (!targetUserId) {
      return c.json({ error: 'Target user ID is required.' }, 400)
    }

    const currentUser = c.get('user')
    if (currentUser.id === targetUserId) {
      return c.json({ error: 'Bạn không thể kết bạn với chính mình.' }, 400)
    }

    const targetUser = await c.env.DB.prepare(
      'SELECT id, display_name FROM users WHERE id = ?'
    ).bind(targetUserId).first<{ id: string, display_name: string }>()
    if (!targetUser) {
      return c.json({ error: 'Người dùng không tồn tại.' }, 404)
    }

    const currentUserProfile = await c.env.DB.prepare(
      'SELECT display_name FROM users WHERE id = ?'
    ).bind(currentUser.id).first<{ display_name: string }>()

    const existing = await c.env.DB.prepare(
      'SELECT * FROM friendships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)'
    ).bind(currentUser.id, targetUserId, targetUserId, currentUser.id).first<{
      id: string
      user_id_1: string
      user_id_2: string
      status: string
    }>()

    const now = Date.now()

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return c.json({ error: 'Hai người đã là bạn bè.' }, 400)
      } else if (existing.status === 'PENDING') {
        if (existing.user_id_1 === currentUser.id) {
          return c.json({ error: 'Lời mời kết bạn đang chờ phản hồi từ đối phương.' }, 400)
        } else {
          await c.env.DB.prepare(
            "UPDATE friendships SET status = 'ACCEPTED', updated_at = ? WHERE id = ?"
          ).bind(now, existing.id).run()

          const notifId = crypto.randomUUID()
          await c.env.DB.prepare(
            'INSERT INTO notifications (id, user_id, title, body, type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(
            notifId,
            targetUserId,
            'Đã chấp nhận kết bạn',
            `${currentUserProfile?.display_name || 'Ai đó'} đã chấp nhận lời mời kết bạn của bạn.`,
            'SYSTEM',
            now
          ).run()

          return c.json({ message: 'Đã chấp nhận lời mời kết bạn thành công!', relationStatus: 'ACCEPTED' })
        }
      } else if (existing.status === 'BLOCKED') {
        return c.json({ error: 'Không thể gửi lời mời kết bạn.' }, 400)
      }
    }

    const friendshipId = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO friendships (id, user_id_1, user_id_2, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(friendshipId, currentUser.id, targetUserId, 'PENDING', now, now).run()

    const notifId = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO notifications (id, user_id, title, body, type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      notifId,
      targetUserId,
      'Lời mời kết bạn mới',
      `${currentUserProfile?.display_name || 'Ai đó'} đã gửi cho bạn một lời mời kết bạn.`,
      'FRIEND_REQUEST',
      now
    ).run()

    return c.json({ message: 'Đã gửi lời mời kết bạn.', relationStatus: 'PENDING_SENT' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Lấy danh sách bạn bè đã kết nối (ACCEPTED)
friends.get('/friends', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user')

    const friendships = await c.env.DB.prepare(
      "SELECT * FROM friendships WHERE (user_id_1 = ? OR user_id_2 = ?) AND status = 'ACCEPTED'"
    ).bind(currentUser.id, currentUser.id).all().then(r => r.results) as any[]

    const friendsList = await Promise.all(friendships.map(async (f) => {
      const friendId = f.user_id_1 === currentUser.id ? f.user_id_2 : f.user_id_1
      const friend = await c.env.DB.prepare(
        'SELECT id, display_name, email, uid, avatar_url, bio, public_key, key_version FROM users WHERE id = ?'
      ).bind(friendId).first<{
        id: string
        display_name: string
        email: string
        uid: number
        avatar_url: string | null
        bio: string | null
        public_key: string | null
        key_version: number | null
      }>()

      return {
        friendshipId: f.id,
        id: friend?.id,
        displayName: friend?.display_name,
        email: friend?.email,
        uid: friend?.uid,
        avatarUrl: friend?.avatar_url,
        bio: friend?.bio,
        relationStatus: 'ACCEPTED',
        publicKey: friend?.public_key || null,
        keyVersion: friend?.key_version ?? 1
      }
    }))

    return c.json(friendsList)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Lấy danh sách lời mời kết bạn đang chờ nhận (PENDING)
friends.get('/friends/requests', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user')

    const requests = await c.env.DB.prepare(
      "SELECT * FROM friendships WHERE user_id_2 = ? AND status = 'PENDING'"
    ).bind(currentUser.id).all().then(r => r.results) as any[]

    const requestList = await Promise.all(requests.map(async (f) => {
      const requester = await c.env.DB.prepare(
        'SELECT id, display_name, email, uid, avatar_url, bio FROM users WHERE id = ?'
      ).bind(f.user_id_1).first<{
        id: string
        display_name: string
        email: string
        uid: number
        avatar_url: string | null
        bio: string | null
      }>()

      return {
        friendshipId: f.id,
        id: requester?.id,
        displayName: requester?.display_name,
        email: requester?.email,
        uid: requester?.uid,
        avatarUrl: requester?.avatar_url,
        bio: requester?.bio,
        createdAt: f.created_at
      }
    }))

    return c.json(requestList)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Chấp nhận hoặc Từ chối yêu cầu kết bạn
friends.post('/friends/respond', authMiddleware, async (c) => {
  try {
    const { friendshipId, action } = await c.req.json<{ friendshipId: string; action: 'ACCEPT' | 'DECLINE' }>()
    if (!friendshipId || !action) {
      return c.json({ error: 'Friendship ID and action are required.' }, 400)
    }

    const currentUser = c.get('user')

    const friendship = await c.env.DB.prepare(
      'SELECT * FROM friendships WHERE id = ?'
    ).bind(friendshipId).first<{
      id: string
      user_id_1: string
      user_id_2: string
      status: string
    }>()

    if (!friendship) {
      return c.json({ error: 'Yêu cầu kết bạn không tồn tại.' }, 404)
    }

    if (friendship.user_id_2 !== currentUser.id) {
      return c.json({ error: 'Bạn không có quyền thực hiện hành động này.' }, 403)
    }

    const now = Date.now()

    if (action === 'ACCEPT') {
      await c.env.DB.prepare(
        "UPDATE friendships SET status = 'ACCEPTED', updated_at = ? WHERE id = ?"
      ).bind(now, friendshipId).run()

      const requester = await c.env.DB.prepare('SELECT display_name FROM users WHERE id = ?').bind(friendship.user_id_1).first<{ display_name: string }>()
      const current = await c.env.DB.prepare('SELECT display_name FROM users WHERE id = ?').bind(currentUser.id).first<{ display_name: string }>()

      const notifId = crypto.randomUUID()
      await c.env.DB.prepare(
        'INSERT INTO notifications (id, user_id, title, body, type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        notifId,
        friendship.user_id_1,
        'Đã chấp nhận kết bạn',
        `${current?.display_name || 'Ai đó'} đã chấp nhận lời mời kết bạn của bạn.`,
        'SYSTEM',
        now
      ).run()

      return c.json({ message: 'Đã chấp nhận kết bạn.', relationStatus: 'ACCEPTED' })
    } else if (action === 'DECLINE') {
      await c.env.DB.prepare(
        'DELETE FROM friendships WHERE id = ?'
      ).bind(friendshipId).run()

      return c.json({ message: 'Đã từ chối lời mời kết bạn.', relationStatus: 'NONE' })
    } else {
      return c.json({ error: 'Hành động không hợp lệ. Chỉ chấp nhận ACCEPT hoặc DECLINE.' }, 400)
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Lấy toàn bộ lịch sử khóa công khai của một người dùng (phục vụ giải mã tin nhắn cũ)
friends.get('/users/:id/public-keys', authMiddleware, async (c) => {
  try {
    const targetId = c.req.param('id')
    const results = await c.env.DB.prepare(
      'SELECT key_version, public_key, created_at FROM user_public_keys WHERE user_id = ? ORDER BY key_version DESC'
    ).bind(targetId).all()

    return c.json(results.results || [])
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default friends
