import { Hono } from 'hono'
import { Env, Variables } from '../types/env'
import { authMiddleware } from '../middlewares/auth'
import { AuthService } from '../services/authService'

const auth = new Hono<{ Bindings: Env; Variables: Variables }>()

// API: Gửi mã OTP về Email
auth.post('/send-otp', async (c) => {
  try {
    const { email } = await c.req.json<{ email: string }>()
    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }

    const result = await AuthService.sendOtp(c.env, email)
    if (!result.success) {
      return c.json({ error: result.error }, result.status as any)
    }

    return c.json({ message: result.message })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Đăng ký tài khoản mới (Xác thực qua OTP)
auth.post('/register', async (c) => {
  try {
    const payload = await c.req.json<{
      email: string
      otp: string
      password: string
      displayName: string
    }>()

    if (!payload.email || !payload.otp || !payload.password || !payload.displayName) {
      return c.json({ error: 'Tất cả các thông tin là bắt buộc' }, 400)
    }

    const result = await AuthService.register(c.env, payload)
    if (!result.success) {
      return c.json({ error: result.error, code: result.code }, result.status as any)
    }

    return c.json({
      message: 'Đăng ký tài khoản thành công.',
      token: result.token,
      user: result.user
    }, 201)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Đăng nhập bằng Email & Mật khẩu (Rate Limit: 5 lần/phút)
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{ email: string; password?: string }>()
    if (!email || !password) {
      return c.json({ error: 'Email và mật khẩu là bắt buộc' }, 400)
    }

    const result = await AuthService.login(c.env, { email, password })
    if (!result.success) {
      return c.json({ error: result.error }, result.status as any)
    }

    return c.json({
      message: 'Đăng nhập thành công.',
      token: result.token,
      user: result.user
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Gửi mã OTP khôi phục mật khẩu (Quên mật khẩu)
auth.post('/send-otp-reset', async (c) => {
  try {
    const { email } = await c.req.json<{ email: string }>()
    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }

    const result = await AuthService.sendOtpReset(c.env, email)
    if (!result.success) {
      return c.json({ error: result.error }, result.status as any)
    }

    return c.json({ message: result.message })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Khôi phục và đặt lại mật khẩu mới
auth.post('/reset-password', async (c) => {
  try {
    const payload = await c.req.json<{
      email: string
      otp: string
      newPassword?: string
    }>()

    if (!payload.email || !payload.otp || !payload.newPassword) {
      return c.json({ error: 'Tất cả các thông tin là bắt buộc' }, 400)
    }

    const result = await AuthService.resetPassword(c.env, payload)
    if (!result.success) {
      return c.json({ error: result.error, code: result.code }, result.status as any)
    }

    return c.json({ message: result.message })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Gửi mã OTP xác thực trước khi xoay vòng cặp khóa E2EE
auth.post('/keys/send-otp', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const result = await AuthService.sendOtpKeyRotate(c.env, user.email)
    if (!result.success) {
      return c.json({ error: result.error }, (result.status as any) || 500)
    }
    return c.json({ message: result.message })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Thiết lập hoặc xoay vòng cặp khóa E2EE của người dùng hiện tại
auth.post('/keys/setup', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { publicKey, encryptedPrivateKey, recoverySalt, keyVersion, otp } = await c.req.json<{
      publicKey: string
      encryptedPrivateKey: string
      recoverySalt: string
      keyVersion: number
      otp?: string
    }>()

    if (!publicKey || !encryptedPrivateKey || !recoverySalt || !keyVersion) {
      return c.json({ error: 'Thiếu thông tin khóa mã hóa.' }, 400)
    }

    const result = await AuthService.setupKeys(c.env, user.id, {
      publicKey,
      encryptedPrivateKey,
      recoverySalt,
      keyVersion,
      otp
    })

    if (!result.success) {
      return c.json({ error: result.error }, (result.status as any) || 400)
    }

    return c.json({ message: 'Thiết lập khóa mã hóa thành công.', keyVersion: result.keyVersion })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API: Lấy thông tin cặp khóa E2EE để khôi phục trên thiết bị mới
auth.get('/keys', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const result = await AuthService.getKeys(c.env, user.id)

    if (!result.success) {
      return c.json({ error: result.error }, (result.status as any) || 500)
    }

    if (!result.hasKeys) {
      return c.json({ hasKeys: false })
    }

    return c.json({
      hasKeys: true,
      publicKey: result.publicKey,
      encryptedPrivateKey: result.encryptedPrivateKey,
      recoverySalt: result.recoverySalt,
      keyVersion: result.keyVersion ?? 1
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default auth

