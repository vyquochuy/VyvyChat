import { Env } from '../types/env'

export class UserPresenceDO implements DurableObject {
  private sessions = new Set<WebSocket>()
  private status = 'offline'
  private lastSeen = Date.now()

  constructor(private state: DurableObjectState, private env: Env) {
    // Đọc trạng thái từ DO storage nếu có sẵn để giữ tính nhất quán khi khởi động lại
    this.state.blockConcurrencyWhile(async () => {
      this.lastSeen = (await this.state.storage.get<number>('lastSeen')) || Date.now()
      this.status = (await this.state.storage.get<string>('status')) || 'offline'
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // ============================================================
    // HTTP Endpoint: Nhận Toast Notification từ ConversationDO
    // Gửi sự kiện new_message đến tất cả các kết nối Presence của User
    // ============================================================
    if (url.pathname === '/send-notification' && request.method === 'POST') {
      try {
        const payload = await request.json()
        const message = JSON.stringify(payload)

        let delivered = 0
        for (const ws of this.sessions) {
          try {
            ws.send(message)
            delivered++
          } catch {
            this.sessions.delete(ws)
          }
        }

        return new Response(JSON.stringify({ delivered }), {
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (err: any) {
        return new Response(err.message, { status: 400 })
      }
    }

    // WebSocket Upgrader Endpoint
    if (request.headers.get('Upgrade') === 'websocket') {
      const userId = request.headers.get('X-User-Id')
      if (!userId) {
        return new Response('Unauthorized', { status: 401 })
      }

      const pair = new WebSocketPair()
      const [clientWS, serverWS] = Object.values(pair)

      await this.handleSession(serverWS, userId)

      return new Response(null, {
        status: 101,
        webSocket: clientWS
      })
    }

    // HTTP Endpoint: Kiểm tra trạng thái trực tuyến in-memory (không gọi CSDL)
    if (url.pathname === '/status') {
      return new Response(
        JSON.stringify({
          status: this.status,
          lastSeen: this.lastSeen
        }),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response('Not Found', { status: 404 })
  }

  private async handleSession(ws: WebSocket, userId: string) {
    ws.accept()
    this.sessions.add(ws)

    // Nếu đây là kết nối đầu tiên của User này, cập nhật trạng thái là online
    if (this.status !== 'online') {
      this.status = 'online'
      await this.state.storage.put('status', 'online')
    }

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data as string)
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
        }
      } catch (err) {
        console.error('Presence DO Message Handling Error:', err)
      }
    })

    const handleClose = () => {
      this.sessions.delete(ws)

      // Nếu không còn kết nối nào hoạt động, chuyển trạng thái về offline
      if (this.sessions.size === 0) {
        this.status = 'offline'
        this.lastSeen = Date.now()

        this.state.waitUntil(
          Promise.all([
            this.state.storage.put('status', 'offline'),
            this.state.storage.put('lastSeen', this.lastSeen),
            // Cập nhật mốc thời gian hoạt động cuối cùng xuống bảng users trong D1
            this.env.DB.prepare('UPDATE users SET updated_at = ? WHERE id = ?')
              .bind(this.lastSeen, userId)
              .run()
          ]).catch(err => console.error('Error updating offline status in D1:', err))
        )
      }
    }

    ws.addEventListener('close', handleClose)
    ws.addEventListener('error', handleClose)
  }
}
