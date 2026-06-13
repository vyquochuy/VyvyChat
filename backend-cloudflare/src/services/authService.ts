import { Env } from '../types/env'
import { hashPassword, verifyPassword } from '../utils/crypto'
import { checkRateLimit } from '../utils/rateLimiter'
import { sign } from 'hono/jwt'

export type OtpContext = 'register' | 'reset' | 'key_rotate'

export class AuthService {
  /**
   * Helper method to generate, rate-limit, and send OTP codes via webhook or print to mock log.
   */
  static async generateAndSendOtp(
    env: Env,
    email: string,
    context: OtpContext
  ): Promise<{ success: boolean; message?: string; error?: string; status?: number }> {
    const cleanEmail = email.trim().toLowerCase()

    // 1. Database existence checks
    if (context === 'register') {
      const existingUser = await env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(cleanEmail).first()
      if (existingUser) {
        return { success: false, error: 'Email này đã được đăng ký tài khoản.', status: 400 }
      }
    } else if (context === 'reset') {
      const existingUser = await env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(cleanEmail).first()
      if (!existingUser) {
        return { success: false, error: 'Email này chưa được đăng ký tài khoản trên hệ thống.', status: 400 }
      }
    }

    // 2. Check rate limit
    const prefix = context === 'register' ? 'otp' : `otp_${context}`
    const rateLimitKey = `rate:${prefix}:${cleanEmail}`
    const isAllowed = await checkRateLimit(env.OTP_KV, rateLimitKey, 3, 900) // 3 times per 15 minutes
    if (!isAllowed) {
      const contextName = context === 'key_rotate' ? 'mã xác thực' : 'OTP'
      return { success: false, error: `Gửi ${contextName} quá thường xuyên. Vui lòng thử lại sau 15 phút.`, status: 429 }
    }

    // 3. Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

    // 4. Hash OTP with SHA-256 for secure storage
    const encoder = new TextEncoder()
    const data = encoder.encode(otpCode)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const otpHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // 5. Store hash in KV with a 5-minute TTL
    const otpKey = context === 'register' ? `otp:${cleanEmail}` : `otp_${context}:${cleanEmail}`
    await env.OTP_KV.put(otpKey, otpHash, { expirationTtl: 300 })

    // 6. Trigger GAS Webhook to send actual email
    const gasUrl = env.GAS_WEBHOOK_URL
    if (gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, otp: otpCode, type: context }),
        })
        if (response.status === 200) {
          console.log(`[Email Service] OTP email sent successfully to ${cleanEmail} via Webhook (type: ${context}).`)
        } else {
          console.error(`[Email Service] Webhook returned error code: ${response.status}`)
        }
      } catch (err) {
        console.error(`[Email Service] Failed to invoke Webhook: ${err}`)
      }
    } else {
      console.log(`\n=========================================`)
      console.log(`MOCK EMAIL TO: ${cleanEmail}`)
      console.log(`CONTEXT: ${context}`)
      console.log(`OTP CODE: ${otpCode}`)
      console.log(`GAS_WEBHOOK_URL not configured. Printed to console.`)
      console.log(`=========================================\n`)
    }

    const successMessage = context === 'register'
      ? 'OTP sent successfully. Please check your email.'
      : context === 'reset'
        ? 'Mã OTP khôi phục mật khẩu đã được gửi đến email của bạn.'
        : 'Mã xác thực đã được gửi về email của bạn.'

    return { success: true, message: successMessage }
  }

  /**
   * Helper method to verify OTP codes from KV with rate limits / brute force protection.
   */
  static async verifyOtp(
    env: Env,
    email: string,
    otp: string,
    context: OtpContext
  ): Promise<{ success: boolean; error?: string; code?: string; status?: number }> {
    const cleanEmail = email.trim().toLowerCase()
    const prefix = context === 'register' ? 'otp' : `otp_${context}`
    const otpKey = `${prefix}:${cleanEmail}`
    const attemptsKey = `${prefix}_attempts:${cleanEmail}`

    // 1. Verify OTP hash in KV
    const savedHash = await env.OTP_KV.get(otpKey)
    if (!savedHash) {
      const errorMsg = context === 'key_rotate'
        ? 'Mã OTP xác thực không hợp lệ hoặc đã hết hạn.'
        : 'Mã OTP không hợp lệ hoặc đã hết hạn.'
      return { success: false, error: errorMsg, status: 400 }
    }

    // 2. Brute force protection (max 5 attempts)
    const attemptsData = await env.OTP_KV.get(attemptsKey)
    let attempts = attemptsData ? parseInt(attemptsData, 10) : 0

    const encoder = new TextEncoder()
    const otpData = encoder.encode(otp)
    const hashBuffer = await crypto.subtle.digest('SHA-256', otpData)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    if (inputHash !== savedHash) {
      attempts++
      if (attempts >= 5) {
        await env.OTP_KV.delete(otpKey)
        await env.OTP_KV.delete(attemptsKey)
        return {
          success: false,
          error: 'Mã xác thực đã bị khóa do nhập sai quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.',
          code: 'OTP_LOCKED',
          status: 400
        }
      } else {
        await env.OTP_KV.put(attemptsKey, attempts.toString(), { expirationTtl: 300 })
        const errorMsg = context === 'key_rotate'
          ? `Mã xác thực không chính xác. Bạn còn ${5 - attempts} lần thử.`
          : `Mã OTP không chính xác. Bạn còn ${5 - attempts} lần thử.`
        return { success: false, error: errorMsg, status: 400 }
      }
    }

    // OTP verified: clear invalid attempts and the OTP itself to prevent replay
    await env.OTP_KV.delete(attemptsKey)
    await env.OTP_KV.delete(otpKey)

    return { success: true }
  }

  /**
   * Send verification OTP via GAS Webhook and save hash in KV.
   */
  static async sendOtp(env: Env, email: string): Promise<{ success: boolean; message?: string; error?: string; status?: number }> {
    return this.generateAndSendOtp(env, email, 'register')
  }

  /**
   * Register a new user with OTP verification.
   */
  static async register(
    env: Env,
    payload: { email: string; otp: string; password: string; displayName: string }
  ): Promise<{ success: boolean; token?: string; user?: any; error?: string; code?: string; status?: number }> {
    const { email, otp, password, displayName } = payload
    const cleanEmail = email.trim().toLowerCase()

    // 1. Verify OTP hash in KV
    const verifyRes = await this.verifyOtp(env, email, otp, 'register')
    if (!verifyRes.success) {
      return { success: false, error: verifyRes.error, code: verifyRes.code, status: verifyRes.status }
    }

    // 2. Check D1 to verify email uniqueness
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(cleanEmail).first()

    if (existingUser) {
      return { success: false, error: 'Email này đã được sử dụng bởi tài khoản khác.', status: 400 }
    }

    // 3. Hash password
    const passwordHash = await hashPassword(password)
    const userId = crypto.randomUUID()
    const now = Date.now()

    // 4. Save new User row
    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, display_name, uid, created_at, updated_at) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(uid), 9999999) + 1 FROM users), ?, ?)'
    ).bind(userId, cleanEmail, passwordHash, displayName, now, now).run()

    const userRow = await env.DB.prepare(
      'SELECT uid FROM users WHERE id = ?'
    ).bind(userId).first<{ uid: number }>()
    const userUid = userRow?.uid || 10000000

    // 5. Generate JWT Token (30 days validity)
    const jwtSecret = env.JWT_SECRET || 'vivychat_jwt_secret_key'
    const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    const token = await sign({ id: userId, email: cleanEmail, exp }, jwtSecret)

    return {
      success: true,
      token,
      user: {
        id: userId,
        email: cleanEmail,
        displayName,
        uid: userUid
      }
    }
  }

  /**
   * Log in an existing user with Email & Password.
   */
  static async login(
    env: Env,
    payload: { email: string; password: string }
  ): Promise<{ success: boolean; token?: string; user?: any; error?: string; status?: number }> {
    const { email, password } = payload
    const cleanEmail = email.trim().toLowerCase()

    // 1. Rate limit logins
    const rateLimitKey = `rate:login:${cleanEmail}`
    const isAllowed = await checkRateLimit(env.OTP_KV, rateLimitKey, 5, 60) // 5 times per 1 minute
    if (!isAllowed) {
      return { success: false, error: 'Đăng nhập quá thường xuyên. Vui lòng thử lại sau 1 phút.', status: 429 }
    }

    // 2. Fetch user from D1
    const user = await env.DB.prepare(
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
      return { success: false, error: 'Email hoặc mật khẩu không chính xác.', status: 400 }
    }

    // 3. Verify password hash
    const isPasswordValid = await verifyPassword(password, user.password_hash)
    if (!isPasswordValid) {
      return { success: false, error: 'Email hoặc mật khẩu không chính xác.', status: 400 }
    }

    // 4. Generate JWT Token (30 days validity)
    const jwtSecret = env.JWT_SECRET || 'vivychat_jwt_secret_key'
    const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    const token = await sign({ id: user.id, email: user.email, exp }, jwtSecret)

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        uid: user.uid,
        avatarUrl: user.avatar_url,
        bio: user.bio
      }
    }
  }

  /**
   * Send reset OTP to registered email.
   */
  static async sendOtpReset(env: Env, email: string): Promise<{ success: boolean; message?: string; error?: string; status?: number }> {
    return this.generateAndSendOtp(env, email, 'reset')
  }

  /**
   * Reset user password with OTP verification.
   */
  static async resetPassword(
    env: Env,
    payload: { email: string; otp: string; newPassword?: string }
  ): Promise<{ success: boolean; message?: string; error?: string; code?: string; status?: number }> {
    const { email, otp, newPassword } = payload
    if (!newPassword) {
      return { success: false, error: 'Mật khẩu mới là bắt buộc', status: 400 }
    }

    // 1. Verify OTP in KV
    const verifyRes = await this.verifyOtp(env, email, otp, 'reset')
    if (!verifyRes.success) {
      return { success: false, error: verifyRes.error, code: verifyRes.code, status: verifyRes.status }
    }

    // 2. Hash password
    const passwordHash = await hashPassword(newPassword)
    const now = Date.now()

    // 3. Update database
    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?'
    ).bind(passwordHash, now, email.trim().toLowerCase()).run()

    return { success: true, message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' }
  }

  /**
   * Send 2FA OTP for key rotation to registered email.
   */
  static async sendOtpKeyRotate(env: Env, email: string): Promise<{ success: boolean; message?: string; error?: string; status?: number }> {
    return this.generateAndSendOtp(env, email, 'key_rotate')
  }

  /**
   * Setup E2EE encryption key pair for user (Requires OTP if keys are already set up)
   */
  static async setupKeys(
    env: Env,
    userId: string,
    payload: { publicKey: string; encryptedPrivateKey: string; recoverySalt: string; keyVersion: number; otp?: string }
  ): Promise<{ success: boolean; keyVersion?: number; error?: string; status?: number }> {
    const { publicKey, encryptedPrivateKey, recoverySalt, keyVersion, otp } = payload
    const now = Date.now()

    // 1. Check if user already has configured E2EE keys
    const userRow = await env.DB.prepare(
      'SELECT email, public_key FROM users WHERE id = ?'
    ).bind(userId).first<{ email: string; public_key: string | null }>()

    if (!userRow) {
      return { success: false, error: 'Người dùng không tồn tại.', status: 404 }
    }

    const { email, public_key } = userRow

    if (public_key) {
      // Rotation/reset requires a valid OTP
      if (!otp) {
        return { success: false, error: 'Mã OTP xác thực là bắt buộc khi xoay vòng khóa.', status: 400 }
      }

      const verifyRes = await this.verifyOtp(env, email, otp, 'key_rotate')
      if (!verifyRes.success) {
        return { success: false, error: verifyRes.error, status: 400 }
      }
    }

    // 2. Update the user record with the E2EE keys
    await env.DB.prepare(
      'UPDATE users SET public_key = ?, encrypted_private_key = ?, recovery_salt = ?, key_version = ?, updated_at = ? WHERE id = ?'
    ).bind(publicKey, encryptedPrivateKey, recoverySalt, keyVersion, now, userId).run()

    // 3. Add or update the key version in the user_public_keys history table
    await env.DB.prepare(
      'INSERT OR REPLACE INTO user_public_keys (user_id, key_version, public_key, created_at) VALUES (?, ?, ?, ?)'
    ).bind(userId, keyVersion, publicKey, now).run()

    return { success: true, keyVersion }
  }

  /**
   * Get E2EE keys for user recovery
   */
  static async getKeys(
    env: Env,
    userId: string
  ): Promise<{
    success: boolean
    hasKeys: boolean
    publicKey?: string
    encryptedPrivateKey?: string
    recoverySalt?: string
    keyVersion?: number
    error?: string
    status?: number
  }> {
    const userData = await env.DB.prepare(
      'SELECT public_key, encrypted_private_key, recovery_salt, key_version FROM users WHERE id = ?'
    ).bind(userId).first<{
      public_key: string | null
      encrypted_private_key: string | null
      recovery_salt: string | null
      key_version: number | null
    }>()

    if (!userData || !userData.public_key) {
      return { success: true, hasKeys: false }
    }

    return {
      success: true,
      hasKeys: true,
      publicKey: userData.public_key,
      encryptedPrivateKey: userData.encrypted_private_key || undefined,
      recoverySalt: userData.recovery_salt || undefined,
      keyVersion: userData.key_version ?? 1
    }
  }
}


