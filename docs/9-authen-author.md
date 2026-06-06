# Chuyên Đề 9: Authentication & Authorization - Phân Biệt & Hiện Thực Xác Thực và Phân Quyền

Trong bất kỳ hệ thống phần mềm có người dùng nào, bảo mật luôn là cốt lõi. Hai khái niệm nền tảng thường bị nhầm lẫn nhưng có vai trò hoàn toàn khác nhau là **Authentication (Xác thực)** và **Authorization (Phân quyền/Ủy quyền)**. Bài học này sẽ giúp bạn hiểu sâu sắc bản chất của chúng và cách dự án **VivyChat** hiện thực hóa hai quy trình này một cách an toàn.

---

## 1. Phân biệt Authentication và Authorization

| Tiêu chí | Authentication (Xác thực / Đăng nhập) | Authorization (Phân quyền / Ủy quyền) |
|---|---|---|
| **Câu hỏi cốt lõi** | **"Bạn là ai?"** | **"Bạn có quyền làm gì ở đây?"** |
| **Mục đích** | Xác định danh tính thực sự của người dùng truy cập hệ thống. | Xác định các tài nguyên và hành động mà người dùng đã xác thực được phép truy cập/thực hiện. |
| **Đầu vào** | Email, Mật khẩu, Mã OTP, Sinh trắc học (Fingerprint, FaceID), JWT token... | Vai trò (Role: Admin, User), Danh sách quyền (Permissions), hoặc ID của chính người dùng (để kiểm tra quyền sở hữu). |
| **Thời điểm chạy** | Diễn ra đầu tiên khi người dùng mở ứng dụng và muốn đăng nhập. | Diễn ra liên tục sau khi đã xác định được danh tính người dùng ở mọi API bảo mật. |

---

## 2. Quy trình Authentication (Xác thực) trong dự án

Dự án **VivyChat** cung cấp hai luồng Authentication chính: **Đăng ký tài khoản mới** (Xác thực thông qua OTP Email) và **Đăng nhập** (Xác thực thông qua Email & Mật khẩu).

### A. Luồng Đăng ký tài khoản (Register với OTP)
Để chống lại việc đăng ký tài khoản giả mạo (Spam Account), hệ thống yêu cầu xác thực email sở hữu bằng mã OTP:
1. **Yêu cầu gửi OTP**:
   - Frontend gửi POST yêu cầu đến `/api/auth/send-otp`.
   - Backend sinh mã OTP 6 số ngẫu nhiên, **băm SHA-256** mã này rồi lưu vào Cloudflare KV với thời gian sống **TTL là 5 phút (300 giây)**.
   - Backend gọi Google Apps Script Webhook để gửi email chứa mã OTP thô cho người dùng.
2. **Xác thực và Tạo tài khoản**:
   - Người dùng nhập mã OTP, Tên hiển thị, Mật khẩu và gửi lên `/api/auth/register`.
   - **Xác thực OTP**: Backend băm mã OTP người dùng nhập và đối chiếu với mã hash đã lưu ở KV.
     - *Chống Brute-force OTP:* Hệ thống lưu số lần thử sai vào KV. Nếu sai quá 5 lần, mã OTP bị khóa và xóa ngay lập tức.
   - **Mã hóa mật khẩu**: Sử dụng hàm `hashPassword` (thuật toán PBKDF2 Web Crypto API) để băm mật khẩu thành một chuỗi bảo mật trước khi lưu vào D1 Database.
   - **Tạo JWT**: Sau khi tạo tài khoản thành công, backend sinh JWT token gửi về cho client để client tự động đăng nhập.

### B. Luồng Đăng nhập (Login với Password)
1. Người dùng gửi Email và Mật khẩu thô lên `/api/auth/login`.
2. Backend thực hiện truy vấn D1 Database để tìm người dùng theo Email đã được chuẩn hóa (lowercase + trim).
3. Sử dụng helper `verifyPassword` để kiểm tra mật khẩu người dùng nhập có khớp với chuỗi hash PBKDF2 lưu trong cơ sở dữ liệu hay không.
4. Nếu khớp, Backend sinh mã JWT (chứa `id` và `email` của người dùng, hạn dùng 30 ngày) gửi về cho client.

---

## 3. Quy trình Authorization (Phân quyền & Kiểm soát truy cập) trong dự án

Khi người dùng đã đăng nhập thành công và sở hữu JWT Token, mọi request tiếp theo của họ gửi lên các API bảo mật đều phải đi qua chốt chặn **Authorization**.

Dự án thực hiện cơ chế **Kiểm soát quyền truy cập dựa trên dữ liệu sở hữu (Row-Level / Owner Authorization)** thông qua Middleware trung gian.

```
Request từ Client ──> [ CORS Middleware ]
                          │ (Hợp lệ)
                          ▼
                     [ IP Rate Limiter ]
                          │ (Dưới ngưỡng tấn công)
                          ▼
                     [ authMiddleware ] <─── XÁC THỰC JWT & TRÍCH XUẤT USER ID
                          │ (Token hợp lệ)
                          ▼
                     [ API Route Handler ] <─── KIỂM TRA QUYỀN SỞ HỮU DỮ LIỆU
                          │ (Đúng chủ sở hữu)
                          ▼
                     [ Phản hồi dữ liệu JSON ]
```

### Bước 1: Middleware xác thực JWT (`authMiddleware`)
Tất cả các endpoint bảo mật (như `/api/friends`, `/api/users/search`, `/api/notifications`) đều đính kèm `authMiddleware` đứng trước:

```typescript
// Trích từ backend-cloudflare/src/middlewares/auth.ts
export async function authMiddleware(c: Context, next: Next) {
  try {
    // 1. Đọc header Authorization gửi lên từ Client
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Không tìm thấy mã xác thực. Vui lòng đăng nhập lại.' }, 401)
    }

    const token = authHeader.substring(7) // Cắt bỏ chữ "Bearer " để lấy token gốc
    const jwtSecret = c.env.JWT_SECRET || 'vivychat_jwt_secret_key'
    
    // 2. Giải mã và kiểm tra chữ ký JWT
    const payload = await verify(token, jwtSecret, 'HS256')
    
    // 3. Đính kèm thông tin User đã xác thực vào Hono Context
    c.set('user', {
      id: payload.id as string,
      email: payload.email as string
    })

    // 4. Cho phép request đi tiếp vào API logic chính
    await next()
  } catch (error) {
    // Trả về 401 Unauthorized nếu token sai chữ ký hoặc hết hạn
    return c.json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' }, 401)
  }
}
```

### Bước 2: Kiểm soát quyền hạn dữ liệu trong API Route Handler
Khi vượt qua được `authMiddleware`, thông tin người dùng được trích xuất an toàn từ `c.get('user')`. Handler sẽ dùng thông tin này để giới hạn dữ liệu mà người dùng được phép tác động.

#### Ví dụ 1: Lấy danh sách bạn bè (`GET /api/friends`)
Hệ thống chỉ trả về danh sách bạn bè của chính người dùng đang đăng nhập, không bao giờ để lộ bạn bè của người khác:
```typescript
const currentUser = c.get('user') // Lấy ID của người dùng đăng nhập hiện tại

// Chỉ truy vấn những dòng kết bạn liên quan đến currentUser.id
const friendships = await c.env.DB.prepare(
  "SELECT * FROM friendships WHERE (user_id_1 = ? OR user_id_2 = ?) AND status = 'ACCEPTED'"
).bind(currentUser.id, currentUser.id).all().then(r => r.results)
```

#### Ví dụ 2: Phản hồi lời mời kết bạn (`POST /api/friends/respond`)
Đây là một chốt chặn phân quyền cực kỳ quan trọng nhằm chống lỗi **ID Tampering (Thay đổi ID bừa bãi)**:
```typescript
const { friendshipId, action } = await c.req.json()
const currentUser = c.get('user')

// 1. Tìm bản ghi kết bạn từ database
const friendship = await c.env.DB.prepare(
  'SELECT * FROM friendships WHERE id = ?'
).bind(friendshipId).first()

// 2. Kiểm tra phân quyền: Người nhận lời mời kết bạn (user_id_2) 
// bắt buộc phải trùng khớp với người dùng đang đăng nhập hiện tại!
if (friendship.user_id_2 !== currentUser.id) {
  // Trả về 403 Forbidden nếu kẻ xấu cố tình chấp nhận kết bạn hộ người khác
  return c.json({ error: 'Bạn không có quyền thực hiện hành động này.' }, 403)
}
```

---

## 4. Các điểm sáng bảo mật của thiết kế Authen - Author trong dự án

1. **Bảo mật mật khẩu ở mức cao**: Mật khẩu không chỉ băm đơn thuần (như MD5, SHA-256 dễ bị tra cứu bảng cầu vồng - Rainbow table) mà được băm bằng thuật toán kéo giãn khóa **PBKDF2** kèm salt ngẫu nhiên, giúp ngăn chặn hiệu quả các cuộc tấn công Brute-force ngoại tuyến.
2. **Chống Brute-force OTP**: Giới hạn 5 lần nhập sai mã OTP tại Cloudflare KV ngăn chặn hoàn toàn việc kẻ xấu chạy mã tự động đoán từ `000000` đến `999999` để chiếm đoạt email.
3. **Phân cấp bảo mật rõ ràng (Defense in Depth)**:
   - Tầng 1: CORS và Rate Limiter lọc bỏ spammer và request ngoài nguồn cho phép.
   - Tầng 2: `authMiddleware` lọc bỏ các request thiếu hoặc sai Token.
   - Tầng 3: Route logic đối chiếu quyền sở hữu (Owner check) ngăn chặn rò rỉ chéo dữ liệu giữa các tài khoản khác nhau.

---

## 📚 Tóm tắt bài học
* **Authentication** trả lời cho câu hỏi "Bạn là ai?" (thực hiện qua đăng nhập, OTP).
* **Authorization** trả lời cho câu hỏi "Bạn có quyền gì?" (thực hiện qua đối chiếu user ID đính kèm trong Token với dữ liệu sở hữu).
* Luôn sử dụng các thư viện xác thực tiêu chuẩn (`hono/jwt`) và thuật toán băm mật khẩu đủ mạnh (`PBKDF2`).
* Luôn thực hiện kiểm tra quyền sở hữu dữ liệu (Owner Verification) ở Backend trước khi thực hiện chỉnh sửa hoặc trả về thông tin nhạy cảm. Không được tin tưởng hoàn toàn dữ liệu ID truyền lên từ Client mà phải đối chiếu với ID giải mã từ Token bảo mật.
