import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign } from 'hono/jwt'
import { hashPassword, verifyPassword } from './utils/crypto'
import { checkRateLimit } from './utils/rateLimiter'

type Bindings = {
  OTP_KV: KVNamespace
  DB: D1Database
  GAS_WEBHOOK_URL: string
  JWT_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings }>()

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

    // 4. Lưu thông tin User mới vào D1 Database
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, cleanEmail, passwordHash, displayName, now, now).run()

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
        displayName
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
        avatarUrl: user.avatar_url,
        bio: user.bio
      }
    })

  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default app
