import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign } from 'hono/jwt'
import { hashPassword, verifyPassword } from './utils/crypto'
import { checkRateLimit } from './utils/rateLimiter'
import { authMiddleware } from './middlewares/auth'

type Bindings = {
  OTP_KV: KVNamespace
  DB: D1Database
  GAS_WEBHOOK_URL: string
  JWT_SECRET?: string
}

type Variables = {
  user: {
    id: string
    email: string
  }
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

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

// API: Gửi mã OTP về Email (Rate Limit: Tối đa 3 lần/15 phút)
app.post('/api/auth/send-otp', async (c) => {
  try {
    const { email } = await c.req.json<{ email: string }>()
    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }

    const cleanEmail = email.trim().toLowerCase()

    // 1. Kiểm tra xem Email đã có tài khoản trong D1 chưa
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(cleanEmail).first()

    if (existingUser) {
      return c.json({ error: 'Email này đã được đăng ký tài khoản.' }, 400)
    }

    // 2. Kiểm tra giới hạn tần suất gửi OTP
    const rateLimitKey = `rate:otp:${cleanEmail}`
    const isAllowed = await checkRateLimit(c.env.OTP_KV, rateLimitKey, 3, 900) // 3 lần trong 15 phút (900s)
    if (!isAllowed) {
      return c.json({ error: 'Gửi OTP quá thường xuyên. Vui lòng thử lại sau 15 phút.' }, 429)
    }

    // 3. Sinh mã OTP ngẫu nhiên gồm 6 chữ số
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

    // 3. Băm mã OTP bằng thuật toán SHA-256 để lưu trữ an toàn trong KV
    const encoder = new TextEncoder()
    const data = encoder.encode(otpCode)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const otpHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // 4. Lưu mã hash vào KV với TTL là 300 giây (5 phút)
    await c.env.OTP_KV.put(`otp:${email.trim().toLowerCase()}`, otpHash, { expirationTtl: 300 })

    // 5. Gọi webhook sang Google Apps Script để gửi email thực tế
    const gasUrl = c.env.GAS_WEBHOOK_URL
    if (gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: otpCode }),
        })
        if (response.status === 200) {
          console.log(`[Email Service] Email gửi thành công tới ${email} qua Webhook.`)
        } else {
          console.error(`[Email Service] Webhook trả về trạng thái lỗi: ${response.status}`)
        }
      } catch (err) {
        console.error(`[Email Service] Không thể gọi tới Webhook: ${err}`)
      }
    } else {
      console.log(`\n=========================================`)
      console.log(`MOCK EMAIL TO: ${email}`)
      console.log(`OTP CODE: ${otpCode}`)
      console.log(`GAS_WEBHOOK_URL chưa được cấu hình. Chỉ log ra màn hình console.`)
      console.log(`=========================================\n`)
    }

    return c.json({ message: 'OTP sent successfully. Please check your email.' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Đăng ký tài khoản mới (Xác thực qua OTP)
app.post('/api/auth/register', async (c) => {
  try {
    const { email, otp, password, displayName } = await c.req.json<{
      email: string
      otp: string
      password: string
      displayName: string
    }>()

    if (!email || !otp || !password || !displayName) {
      return c.json({ error: 'Tất cả các thông tin là bắt buộc' }, 400)
    }

    const cleanEmail = email.trim().toLowerCase()

    // 1. Kiểm tra và xác thực OTP từ KV
    const savedHash = await c.env.OTP_KV.get(`otp:${cleanEmail}`)
    if (!savedHash) {
      return c.json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn.' }, 400)
    }

    // Kiểm tra số lần thử sai (chống brute force)
    const attemptsKey = `otp_attempts:${cleanEmail}`
    const attemptsData = await c.env.OTP_KV.get(attemptsKey)
    let attempts = attemptsData ? parseInt(attemptsData, 10) : 0

    const encoder = new TextEncoder()
    const otpData = encoder.encode(otp)
    const hashBuffer = await crypto.subtle.digest('SHA-256', otpData)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    if (inputHash !== savedHash) {
      attempts++
      if (attempts >= 5) {
        // Khóa luôn OTP bằng cách xóa khỏi KV
        await c.env.OTP_KV.delete(`otp:${cleanEmail}`)
        await c.env.OTP_KV.delete(attemptsKey)
        return c.json({
          error: 'Mã OTP đã bị khóa do nhập sai quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.',
          code: 'OTP_LOCKED'
        }, 400)
      } else {
        await c.env.OTP_KV.put(attemptsKey, attempts.toString(), { expirationTtl: 300 })
        return c.json({ error: `Mã OTP không chính xác. Bạn còn ${5 - attempts} lần thử.` }, 400)
      }
    }

    // OTP khớp: Xóa số lần thử sai
    await c.env.OTP_KV.delete(attemptsKey)

    // 2. Kiểm tra xem Email đã đăng ký chưa trong D1 Database
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(cleanEmail).first()

    if (existingUser) {
      return c.json({ error: 'Email này đã được sử dụng bởi tài khoản khác.' }, 400)
    }

    // 3. Thực hiện băm mật khẩu bằng helper PBKDF2 Web Crypto
    const passwordHash = await hashPassword(password)
    const userId = crypto.randomUUID()
    const now = Date.now()

    // 4. Lưu thông tin User mới vào D1 Database kèm theo sinh UID tăng dần từ 10000000
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, display_name, uid, created_at, updated_at) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(uid), 9999999) + 1 FROM users), ?, ?)'
    ).bind(userId, cleanEmail, passwordHash, displayName, now, now).run()

    // Lấy UID vừa được tự động tạo để trả về cho Client
    const userRow = await c.env.DB.prepare(
      'SELECT uid FROM users WHERE id = ?'
    ).bind(userId).first<{ uid: number }>()
    const userUid = userRow?.uid || 10000000

    // 5. Xác thực thành công: Xóa OTP để tránh replay attack
    await c.env.OTP_KV.delete(`otp:${cleanEmail}`)

    // 6. Tạo JWT Token có hạn trong 30 ngày
    const jwtSecret = c.env.JWT_SECRET || 'vivychat_jwt_secret_key'
    const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    const token = await sign({ id: userId, email: cleanEmail, exp }, jwtSecret)

    return c.json({
      message: 'Đăng ký tài khoản thành công.',
      token,
      user: {
        id: userId,
        email: cleanEmail,
        displayName,
        uid: userUid
      }
    }, 201)

  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Đăng nhập bằng Email & Mật khẩu (Rate Limit: 5 lần/phút)
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{ email: string; password?: string }>()
    if (!email || !password) {
      return c.json({ error: 'Email và mật khẩu là bắt buộc' }, 400)
    }

    const cleanEmail = email.trim().toLowerCase()

    // 1. Kiểm tra giới hạn tần suất đăng nhập
    const rateLimitKey = `rate:login:${cleanEmail}`
    const isAllowed = await checkRateLimit(c.env.OTP_KV, rateLimitKey, 5, 60) // 5 lần trong 1 phút (60s)
    if (!isAllowed) {
      return c.json({ error: 'Đăng nhập quá thường xuyên. Vui lòng thử lại sau 1 phút.' }, 429)
    }

    // 2. Lấy thông tin user từ D1 Database
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(cleanEmail).first<{
      id: string
      email: string
      password_hash: string
      display_name: string
      uid: number
      avatar_url: string | null
      bio: string | null
    }>()

    if (!user) {
      return c.json({ error: 'Email hoặc mật khẩu không chính xác.' }, 400)
    }

    // 3. So khớp mật khẩu đã băm bằng helper verify
    const isPasswordValid = await verifyPassword(password, user.password_hash)
    if (!isPasswordValid) {
      return c.json({ error: 'Email hoặc mật khẩu không chính xác.' }, 400)
    }

    // 4. Tạo JWT Token hạn 30 ngày
    const jwtSecret = c.env.JWT_SECRET || 'vivychat_jwt_secret_key'
    const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    const token = await sign({ id: user.id, email: user.email, exp }, jwtSecret)

    return c.json({
      message: 'Đăng nhập thành công.',
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        uid: user.uid,
        avatarUrl: user.avatar_url,
        bio: user.bio
      }
    })

  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ==========================================================================
// FRIEND & SEARCH APIS (PROTECTED ROUTES)
// ==========================================================================

// API: Tìm kiếm người dùng bằng UID, Email hoặc Tên hiển thị
app.get('/api/users/search', authMiddleware, async (c) => {
  const query = c.req.query('query')?.trim()
  if (!query) {
    return c.json([])
  }

  const currentUser = c.get('user')

  let users: any[] = []
  if (/^\d+$/.test(query)) {
    const uidVal = parseInt(query, 10)
    users = await c.env.DB.prepare(
      'SELECT id, display_name, email, uid, avatar_url, bio FROM users WHERE uid = ? AND id != ?'
    ).bind(uidVal, currentUser.id).all().then(r => r.results)
  } else if (query.includes('@')) {
    users = await c.env.DB.prepare(
      'SELECT id, display_name, email, uid, avatar_url, bio FROM users WHERE email = ? AND id != ?'
    ).bind(query.toLowerCase(), currentUser.id).all().then(r => r.results)
  } else {
    users = await c.env.DB.prepare(
      'SELECT id, display_name, email, uid, avatar_url, bio FROM users WHERE display_name LIKE ? AND id != ? LIMIT 20'
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
      relationStatus
    }
  }))

  return c.json(populatedUsers)
})

// API: Gửi lời mời kết bạn (hoặc tự động Chấp nhận nếu đối phương đã gửi trước đó)
app.post('/api/friends/request', authMiddleware, async (c) => {
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
app.get('/api/friends', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user')

    const friendships = await c.env.DB.prepare(
      "SELECT * FROM friendships WHERE (user_id_1 = ? OR user_id_2 = ?) AND status = 'ACCEPTED'"
    ).bind(currentUser.id, currentUser.id).all().then(r => r.results) as any[]

    const friendsList = await Promise.all(friendships.map(async (f) => {
      const friendId = f.user_id_1 === currentUser.id ? f.user_id_2 : f.user_id_1
      const friend = await c.env.DB.prepare(
        'SELECT id, display_name, email, uid, avatar_url, bio FROM users WHERE id = ?'
      ).bind(friendId).first<{
        id: string
        display_name: string
        email: string
        uid: number
        avatar_url: string | null
        bio: string | null
      }>()

      return {
        friendshipId: f.id,
        id: friend?.id,
        displayName: friend?.display_name,
        email: friend?.email,
        uid: friend?.uid,
        avatarUrl: friend?.avatar_url,
        bio: friend?.bio,
        relationStatus: 'ACCEPTED'
      }
    }))

    return c.json(friendsList)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Lấy danh sách lời mời kết bạn đang chờ nhận (PENDING)
app.get('/api/friends/requests', authMiddleware, async (c) => {
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
app.post('/api/friends/respond', authMiddleware, async (c) => {
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

// API: Lấy danh sách thông báo của người dùng
app.get('/api/notifications', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user')

    const notifications = await c.env.DB.prepare(
      'SELECT id, title, body, is_read, type, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(currentUser.id).all().then(r => r.results)

    return c.json(notifications)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Đánh dấu thông báo là đã đọc
app.post('/api/notifications/:id/read', authMiddleware, async (c) => {
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

export default app
