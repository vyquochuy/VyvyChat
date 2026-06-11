import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { Env, Variables } from '../types/env'

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  let token = ''

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = c.req.query('token') || ''
  }

  if (!token) {
    return c.json({ error: 'Unauthorized: Missing token' }, 401)
  }

  const jwtSecret = c.env.JWT_SECRET || 'vivychat_jwt_secret_key'

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as { id: string; email: string }
    if (!payload || !payload.id || !payload.email) {
      return c.json({ error: 'Unauthorized: Invalid token payload' }, 401)
    }

    c.set('user', {
      id: payload.id,
      email: payload.email
    })
    await next()
  } catch (err) {
    return c.json({ error: 'Unauthorized: Token is expired or invalid' }, 401)
  }
})
