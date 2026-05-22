import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  OTP_KV: KVNamespace
  GAS_WEBHOOK_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Kích hoạt CORS cho tất cả các origins để Client di động (Flutter) có thể gọi được
app.use('*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Account Manager OTP API (Cloudflare Worker)',
    version: '1.0.0'
  })
})

// API: Gửi mã OTP về Email
app.post('/api/auth/send-otp', async (c) => {
  try {
    const { email } = await c.req.json<{ email: string }>()
    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }

    // Sinh mã OTP ngẫu nhiên gồm 6 chữ số
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Băm mã OTP bằng thuật toán SHA-256 (sử dụng Web Crypto API tích hợp sẵn của Cloudflare)
    const encoder = new TextEncoder()
    const data = encoder.encode(otpCode)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const otpHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Lưu mã hash vào Cloudflare KV với key là email, TTL là 300 giây (5 phút)
    // Sau 5 phút, Cloudflare KV sẽ tự động dọn dẹp và xóa bản ghi này!
    await c.env.OTP_KV.put(email, otpHash, { expirationTtl: 300 })

    // Gọi webhook sang Google Apps Script để gửi email thực tế
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

// API: Xác thực mã OTP
app.post('/api/auth/verify-otp', async (c) => {
  try {
    const { email, otp } = await c.req.json<{ email: string; otp: string }>()
    if (!email || !otp) {
      return c.json({ detail: 'Email and OTP are required' }, 400)
    }

    // Lấy mã hash đã lưu từ KV
    const savedHash = await c.env.OTP_KV.get(email)
    if (!savedHash) {
      return c.json({ detail: 'Invalid or expired OTP.' }, 400)
    }

    // Băm mã OTP người dùng gửi lên để so sánh
    const encoder = new TextEncoder()
    const data = encoder.encode(otp)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Kiểm tra khớp mã hash
    if (inputHash !== savedHash) {
      return c.json({ detail: 'Invalid OTP.' }, 400)
    }

    // OTP đúng: xóa ngay khỏi KV để tránh người dùng tái sử dụng mã này lần 2
    await c.env.OTP_KV.delete(email)

    return c.json({ message: 'OTP verified successfully.' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default app
