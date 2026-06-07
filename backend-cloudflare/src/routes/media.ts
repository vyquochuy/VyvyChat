import { Hono } from 'hono'
import { Env, Variables } from '../types/env'
import { authMiddleware } from '../middlewares/auth'
import { checkRateLimit } from '../utils/rateLimiter'
import { signToken, verifyToken } from '../utils/token'

const media = new Hono<{ Bindings: Env; Variables: Variables }>()

// Size Limits in bytes
const LIMIT_IMAGE = 10 * 1024 * 1024;    // 10MB
const LIMIT_FILE = 50 * 1024 * 1024;     // 50MB
const LIMIT_ZIP = 100 * 1024 * 1024;     // 100MB

// API: Yêu cầu URL upload tệp tin (Proxy Upload Session)
media.post('/upload-url', authMiddleware, async (c) => {
  try {
    const { file_name, file_size, mime_type } = await c.req.json<{
      file_name: string;
      file_size: number;
      mime_type: string;
      sha256?: string;
    }>()

    if (!file_name || !file_size || !mime_type) {
      return c.json({ error: 'Thiếu thông tin file (tên, kích thước, định dạng).' }, 400)
    }

    const currentUser = c.get('user')

    // 1. Kiểm tra kích thước tệp dựa trên định dạng
    let maxLimit = LIMIT_FILE
    const isImage = mime_type.startsWith('image/')
    const isZip = mime_type.includes('zip') || 
                  mime_type.includes('x-zip-compressed') || 
                  file_name.endsWith('.zip') || 
                  file_name.endsWith('.rar') || 
                  file_name.endsWith('.7z')

    if (isImage) {
      maxLimit = LIMIT_IMAGE
    } else if (isZip) {
      maxLimit = LIMIT_ZIP
    }

    if (file_size > maxLimit) {
      const limitStr = maxLimit === LIMIT_IMAGE ? '10MB' : maxLimit === LIMIT_ZIP ? '100MB' : '50MB'
      return c.json({ error: `Kích thước tệp vượt quá giới hạn cho phép (${limitStr}).` }, 400)
    }

    // 2. Kiểm tra Rate Limit: Tối đa 50 uploads / 1 giờ / 1 User
    const rateLimitKey = `rate:upload:${currentUser.id}`
    const isAllowed = await checkRateLimit(c.env.OTP_KV, rateLimitKey, 50, 3600)
    if (!isAllowed) {
      return c.json({ error: 'Bạn đã vượt quá giới hạn tải lên (tối đa 50 tệp/giờ). Vui lòng thử lại sau.' }, 429)
    }

    // 3. Tính toán SHA-256 (nếu client không gửi, ta sẽ tính sau khi upload xong)
    const sha256 = c.req.query('sha256') || ''

    // 4. Tạo R2 Key độc bản
    const fileId = crypto.randomUUID()
    const r2Key = `${fileId}-${file_name}`

    // 5. Tạo signed token có thời hạn 15 phút
    const uploadPayload = {
      action: 'upload',
      key: r2Key,
      size: file_size,
      sha256,
      expires: Date.now() + 15 * 60 * 1000
    }
    const token = await signToken(uploadPayload, c.env.JWT_SECRET || 'fallback-secret')

    // Lấy domain của request hiện tại để tạo upload URL chính xác
    const requestUrl = new URL(c.req.url)
    const uploadUrl = `${requestUrl.protocol}//${requestUrl.host}/api/media/upload?key=${encodeURIComponent(r2Key)}&token=${encodeURIComponent(token)}`

    return c.json({
      upload_url: uploadUrl,
      r2_key: r2Key,
      file_id: fileId
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API Proxy PUT: Nhận stream file từ Client và đẩy thẳng lên R2
media.put('/upload', async (c) => {
  try {
    const key = c.req.query('key')
    const token = c.req.query('token')

    if (!key || !token) {
      return c.json({ error: 'Thiếu tham số key hoặc token.' }, 400)
    }

    // 1. Xác thực token và chữ ký
    const payload = await verifyToken(token, c.env.JWT_SECRET || 'fallback-secret')
    if (!payload || payload.action !== 'upload' || payload.key !== key) {
      return c.json({ error: 'Token tải lên không hợp lệ hoặc đã hết hạn.' }, 403)
    }

    // 2. Kiểm tra khớp kích thước Content-Length (nếu có)
    const contentLength = c.req.header('content-length')
    if (contentLength && parseInt(contentLength, 10) !== payload.size) {
      return c.json({ error: 'Kích thước tệp không khớp với dung lượng đã đăng ký.' }, 400)
    }

    // 3. Đọc request body stream và ghi trực tiếp vào R2
    if (!c.req.raw.body) {
      return c.json({ error: 'Không nhận được dữ liệu tệp tin.' }, 400)
    }

    await c.env.MEDIA_BUCKET.put(key, c.req.raw.body, {
      customMetadata: {
        sha256: payload.sha256 || ''
      }
    })

    return c.json({
      success: true,
      message: 'Tải tệp lên R2 thành công.'
    })
  } catch (error: any) {
    return c.json({ error: 'Lỗi ghi tệp lên R2: ' + error.message }, 500)
  }
})

// API: Yêu cầu URL tải tệp tin về (Chỉ khi scan_status = CLEAN)
media.get('/download-url', authMiddleware, async (c) => {
  try {
    const id = c.req.query('id')
    const r2Key = c.req.query('r2Key')

    if (!id && !r2Key) {
      return c.json({ error: 'Thiếu ID tệp tin hoặc R2 Key.' }, 400)
    }

    // 1. Kiểm tra trong DB
    let attachment: any = null
    if (id) {
      attachment = await c.env.DB.prepare('SELECT * FROM attachments WHERE id = ?').bind(id).first()
    } else if (r2Key) {
      attachment = await c.env.DB.prepare('SELECT * FROM attachments WHERE r2_key = ?').bind(r2Key).first()
    }

    if (!attachment) {
      return c.json({ error: 'Tệp đính kèm không tồn tại.' }, 404)
    }

    // 2. Kiểm tra trạng thái quét mã độc
    if (attachment.scan_status === 'PENDING') {
      return c.json({
        error: 'Tệp tin đang trong tiến trình kiểm tra an toàn. Vui lòng thử lại sau ít giây.',
        status: 'PENDING'
      }, 403)
    }

    if (attachment.scan_status === 'INFECTED') {
      return c.json({
        error: 'Tệp tin đã bị chặn và xóa khỏi hệ thống do phát hiện có dấu hiệu chứa mã độc.',
        status: 'INFECTED'
      }, 403)
    }

    // 3. Tạo signed download token có hiệu lực trong 10 phút
    const downloadPayload = {
      action: 'download',
      key: attachment.r2_key,
      expires: Date.now() + 10 * 60 * 1000
    }
    const token = await signToken(downloadPayload, c.env.JWT_SECRET || 'fallback-secret')

    const requestUrl = new URL(c.req.url)
    const downloadUrl = `${requestUrl.protocol}//${requestUrl.host}/api/media/download?key=${encodeURIComponent(attachment.r2_key)}&token=${encodeURIComponent(token)}`

    // Tăng lượt tải của file đính kèm này ở background
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE attachments SET download_count = download_count + 1 WHERE id = ?')
        .bind(attachment.id)
        .run()
    )

    return c.json({
      download_url: downloadUrl,
      file_name: attachment.file_name,
      file_size: attachment.file_size
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API Proxy GET: Stream file từ R2 trả về cho Client
media.get('/download', async (c) => {
  try {
    const key = c.req.query('key')
    const token = c.req.query('token')

    if (!key || !token) {
      return c.json({ error: 'Thiếu tham số key hoặc token.' }, 400)
    }

    // 1. Xác thực download token
    const payload = await verifyToken(token, c.env.JWT_SECRET || 'fallback-secret')
    if (!payload || payload.action !== 'download' || payload.key !== key) {
      return c.json({ error: 'Token tải xuống không hợp lệ hoặc đã hết hạn.' }, 403)
    }

    // 2. Lấy file từ R2
    const obj = await c.env.MEDIA_BUCKET.get(key)
    if (!obj) {
      return c.json({ error: 'Tệp tin không tồn tại hoặc đã bị xóa.' }, 404)
    }

    // 3. Trả về Response stream file đính kèm với Content-Disposition
    const headers = new Headers()
    obj.writeHttpMetadata(headers)
    headers.set('etag', obj.httpEtag)
    
    // Trích xuất tên tệp tin gốc (bỏ UUID prefix)
    const fileName = key.substring(37) // uuid (36) + '-' (1)
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    headers.set('Access-Control-Expose-Headers', 'Content-Disposition')

    return new Response(obj.body, {
      headers
    })
  } catch (error: any) {
    return c.json({ error: 'Lỗi tải tệp tin từ R2: ' + error.message }, 500)
  }
})

export default media
