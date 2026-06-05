import { Context, Next } from 'hono'
import { verify } from 'hono/jwt'

export async function authMiddleware(c: Context, next: Next) {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Không tìm thấy mã xác thực. Vui lòng đăng nhập lại.' }, 401)
    }

    const token = authHeader.substring(7)
    const jwtSecret = c.env.JWT_SECRET || 'vivychat_jwt_secret_key'
    
    const payload = await verify(token, jwtSecret, 'HS256')
    
    c.set('user', {
      id: payload.id as string,
      email: payload.email as string
    })

    await next()
  } catch (error) {
    return c.json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' }, 401)
  }
}
