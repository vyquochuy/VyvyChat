export class ConversationDO implements DurableObject {
  private sessions = new Map<WebSocket, { userId: string }>()
  private messageCache: Array<any> = []
  private lastFlush = Date.now()
  private batchTimeout: any = null

  constructor(private state: DurableObjectState, private env: { DB: D1Database; ENVIRONMENT?: string }) {
    // Đảm bảo không xử lý request mới cho đến khi khôi phục xong dữ liệu chưa flush
    this.state.blockConcurrencyWhile(async () => {
      await this.recoverAndFlush()
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

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

    return new Response('Not Found', { status: 404 })
  }

  private async handleSession(ws: WebSocket, userId: string) {
    ws.accept()
    this.sessions.set(ws, { userId })

    ws.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string)

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        if (data.type === 'message') {
          const msgId = crypto.randomUUID()
          const timestamp = Date.now()

          const newMsg = {
            id: msgId,
            conversation_id: data.conversation_id,
            sender_id: userId,
            content: data.content,
            type: data.type_msg || 'TEXT',
            message_state: 'NORMAL',
            delivery_state: 'SENT',
            reply_to_id: data.reply_to_id || null,
            created_at: timestamp,
            updated_at: timestamp
          }

          // 1. Lưu trữ buffer vào DO storage để tránh mất dữ liệu (Zero Data Loss)
          await this.state.storage.put(msgId, newMsg)

          // 2. Phát sóng (broadcast) lập tức đến tất cả kết nối trong phòng chat
          this.broadcast({
            type: 'message',
            message: newMsg
          })

          // 3. Đưa vào write-behind cache
          this.messageCache.push(newMsg)

          // 4. Kiểm tra điều kiện flush xuống D1
          const flushInterval = this.env.ENVIRONMENT === 'production' ? 5000 : 2000
          const elapsed = Date.now() - this.lastFlush

          if (this.messageCache.length >= 50 || elapsed >= flushInterval) {
            this.state.waitUntil(this.flushMessages())
          } else {
            this.scheduleFlush(flushInterval - elapsed)
          }
        }

        // Xử lý Client gửi yêu cầu đồng bộ tin nhắn (sync)
        if (data.type === 'sync') {
          const lastCreatedAt = data.lastMessageCreatedAt ? Number(data.lastMessageCreatedAt) : 0
          this.state.waitUntil(this.syncMessages(ws, lastCreatedAt))
        }
      } catch (err) {
        console.error('DO Message Handling Error:', err)
      }
    })

    ws.addEventListener('close', () => {
      this.sessions.delete(ws)
      // Nếu không còn ai kết nối, flush cache lập tức
      if (this.sessions.size === 0 && this.messageCache.length > 0) {
        this.state.waitUntil(this.flushMessages())
      }
    })

    ws.addEventListener('error', () => {
      this.sessions.delete(ws)
      if (this.sessions.size === 0 && this.messageCache.length > 0) {
        this.state.waitUntil(this.flushMessages())
      }
    })
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data)
    for (const [ws] of this.sessions.entries()) {
      try {
        ws.send(payload)
      } catch (err) {
        this.sessions.delete(ws)
      }
    }
  }

  private scheduleFlush(delay: number) {
    if (this.batchTimeout) return

    this.batchTimeout = setTimeout(() => {
      this.batchTimeout = null
      this.state.waitUntil(this.flushMessages())
    }, Math.max(0, delay))
  }

  private async flushMessages() {
    if (this.messageCache.length === 0) return

    const toFlush = [...this.messageCache]
    this.messageCache = []
    this.lastFlush = Date.now()

    try {
      // Chuẩn bị batch statements cho D1
      const statements = toFlush.map(msg => {
        return this.env.DB.prepare(
          'INSERT INTO messages (id, conversation_id, sender_id, content, type, message_state, delivery_state, reply_to_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          msg.id,
          msg.conversation_id,
          msg.sender_id,
          msg.content,
          msg.type,
          msg.message_state,
          msg.delivery_state,
          msg.reply_to_id,
          msg.created_at,
          msg.updated_at
        )
      })

      // Thực thi ghi gộp (batch insert) vào D1
      await this.env.DB.batch(statements)

      // Xóa các tin nhắn tương ứng khỏi DO storage
      const msgIds = toFlush.map(msg => msg.id)
      await this.state.storage.delete(msgIds)
      
      console.log(`[DO Flush] Successfully flushed ${toFlush.length} messages to D1 and cleared DO storage.`)
    } catch (err) {
      console.error('[DO Flush] Failed to flush messages to D1, restoring cache:', err)
      // Khôi phục lại cache ở vị trí đầu tiên
      this.messageCache = [...toFlush, ...this.messageCache]
      this.scheduleFlush(2000)
    }
  }

  private async syncMessages(ws: WebSocket, lastCreatedAt: number) {
    try {
      const convId = this.state.id.toString()
      // Lấy danh sách tin nhắn mới hơn mốc thời gian của client gửi lên
      const query = `
        SELECT * FROM messages 
        WHERE conversation_id = ? AND created_at > ? 
        ORDER BY created_at ASC
      `
      const results = await this.env.DB.prepare(query)
        .bind(convId, lastCreatedAt)
        .all()

      const messages = results.results || []
      
      // Gửi các tin nhắn bị thiếu cho client
      ws.send(JSON.stringify({
        type: 'sync_response',
        messages: messages.map(msg => ({
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          content: msg.content,
          type: msg.type,
          message_state: msg.message_state,
          delivery_state: msg.delivery_state,
          reply_to_id: msg.reply_to_id,
          created_at: msg.created_at,
          updated_at: msg.updated_at
        }))
      }))
    } catch (err) {
      console.error('[DO Sync] Sync failed:', err)
    }
  }

  private async recoverAndFlush() {
    try {
      const stored = await this.state.storage.list()
      const messages = Array.from(stored.values())
      if (messages.length === 0) return

      console.log(`[DO Recovery] Found ${messages.length} unflushed messages in DO storage. Recovering...`)

      const statements = messages.map((msg: any) => {
        return this.env.DB.prepare(
          'INSERT INTO messages (id, conversation_id, sender_id, content, type, message_state, delivery_state, reply_to_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          msg.id,
          msg.conversation_id,
          msg.sender_id,
          msg.content,
          msg.type,
          msg.message_state,
          msg.delivery_state,
          msg.reply_to_id,
          msg.created_at,
          msg.updated_at
        )
      })

      await this.env.DB.batch(statements)

      const msgIds = messages.map((msg: any) => msg.id)
      await this.state.storage.delete(msgIds)

      console.log(`[DO Recovery] Successfully flushed ${messages.length} recovered messages to D1 and cleared DO storage.`)
    } catch (err) {
      console.error('[DO Recovery] Recovery failed:', err)
    }
  }
}
