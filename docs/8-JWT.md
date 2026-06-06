# Chuyên Đề 8: JSON Web Token (JWT) - Giải Pháp Xác Thực Không Trạng Thái (Stateless Authentication)

Khi xây dựng các ứng dụng web hiện đại theo mô hình tách biệt Frontend và Backend, đặc biệt là chạy trên môi trường **Serverless (như Cloudflare Workers)**, việc quản lý phiên đăng nhập của người dùng cần một cơ chế nhẹ nhàng, bảo mật và có thể mở rộng dễ dàng mà không phụ thuộc vào bộ nhớ máy chủ (Session Memory). Giải pháp tối ưu chính là **JWT (JSON Web Token)**.

---

## 1. JWT là gì? Tại sao lại dùng JWT thay cho Session truyền thống?

### Cơ chế Session & Cookie truyền thống (Stateful)
Trong mô hình truyền thống:
1. Client gửi tài khoản/mật khẩu lên Server.
2. Server xác thực thành công, tạo một Session trong bộ nhớ (RAM) hoặc lưu vào Database, đồng thời trả về một chuỗi `session_id` cho Client qua Cookie.
3. Các request sau, Client tự gửi kèm `session_id` này. Server phải tìm kiếm trong cơ sở dữ liệu hoặc RAM để xem `session_id` này là của user nào.

> [!WARNING]  
> **Hạn chế của Session trong Serverless:**
> Cloudflare Workers chạy trên hàng ngàn Edge Node khắp thế giới dưới dạng các Isolates siêu nhẹ. Chúng không chia sẻ bộ nhớ RAM chung. Nếu dùng Session truyền thống, chúng ta buộc phải liên tục truy vấn một Database tập trung để kiểm tra phiên đăng nhập, làm mất đi ưu thế tốc độ cực nhanh (Low Latency) của Edge Computing.

### Cơ chế JWT (Stateless - Không trạng thái)
Với JWT, tất cả thông tin nhận diện người dùng được mã hóa thành một chuỗi ký tự tự chứa (Self-contained) và gửi cho Client lưu trữ.
- Máy chủ **không cần lưu trữ** trạng thái phiên đăng nhập của người dùng.
- Mỗi khi Client gửi request kèm JWT, Server chỉ cần thực hiện các phép toán toán học (verification) để kiểm tra tính hợp lệ và giải mã thông tin.
- Vì không cần gọi Database để check Session, quá trình xác thực diễn ra **ngay lập tức** ở Edge Node gần người dùng nhất.

---

## 2. Cấu trúc của một JWT

Một chuỗi JWT hoàn chỉnh bao gồm 3 phần được ngăn cách với nhau bằng dấu chấm (`.`): `Header.Payload.Signature`

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyM2FhYSIsImVtYWlsIjoidGVzdEBnbWFpbC5jb20iLCJleHAiOjE3MTc2ODk2MDB9.dThpc19pc19hX3NpZ25hdHVyZV9leGFtcGxlXzEyMzQ1Ng
```

### A. Header (Phần đầu)
Chứa thông tin về loại token (thường là `JWT`) và thuật toán mã hóa chữ ký (ví dụ: `HS256` hoặc `RS256`).
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```
*Sau đó, phần này được mã hóa bằng Base64Url.*

### B. Payload (Phần thân dữ liệu)
Chứa các thông tin cần truyền tải (gọi là các **Claims**). Claims là các cặp Key-Value lưu thông tin người dùng hoặc các thông tin bổ sung:
- **Registered claims**: Các key tiêu chuẩn đã được định nghĩa sẵn như `sub` (chủ thể), `exp` (thời gian hết hạn), `iat` (thời điểm tạo).
- **Private claims**: Các key do chúng ta tự định nghĩa để phục vụ logic ứng dụng (ví dụ: `id`, `email`, `role`).
```json
{
  "id": "7fa12b9d-4e92-4f30-8012-789a2468bcde",
  "email": "user@example.com",
  "exp": 1780826400
}
```
*Phần này cũng được mã hóa bằng Base64Url.*
> [!CAUTION]
> Dữ liệu trong Header và Payload chỉ được mã hóa dạng **Base64Url** để truyền tải qua môi trường web chứ **KHÔNG PHẢI MÃ HÓA BẢO MẬT (Encryption)**. Bất cứ ai cũng có thể giải mã Base64Url để đọc nội dung bên trong. Do đó, **tuyệt đối không bao giờ để mật khẩu hoặc thông tin cực kỳ nhạy cảm vào Payload của JWT**.

### C. Signature (Chữ ký số)
Đây là phần quan trọng nhất giúp ngăn chặn việc làm giả token. Chữ ký được tạo ra bằng cách lấy chuỗi mã hóa của Header kết hợp với chuỗi mã hóa của Payload, sau đó ký bằng một thuật toán mã hóa (như HMAC SHA-256) cùng với một **Khóa bí mật (Secret Key)** chỉ có máy chủ biết.

$$\text{Signature} = \text{HMAC-SHA256}(\text{Base64Url(Header)} + "." + \text{Base64Url(Payload)}, \text{SecretKey})$$

Nếu kẻ xấu tự ý sửa thông tin ở Payload (ví dụ: đổi email của người khác để giả mạo tài khoản), khi gửi lên Server, chữ ký tính toán lại sẽ không khớp với chữ ký đính kèm trong token. Server lập tức từ chối yêu cầu.

---

## 3. Cách JWT hoạt động trong dự án này

Dự án **VivyChat / Email-Verify** áp dụng JWT bằng cách tích hợp trực tiếp thư viện `hono/jwt` được tối ưu hóa cho Cloudflare Workers Edge.

```mermaid
sequenceDiagram
    participant Client as Frontend (React)
    participant Worker as Backend Worker
    participant DB as SQLite (D1 Database)

    Client->>Worker: 1. Đăng nhập/Đăng ký (email, password)
    Worker->>DB: Kiểm tra tài khoản & mật khẩu
    DB-->>Worker: Tài khoản hợp lệ
    Note over Worker: 2. Ký JWT Token bằng Secret Key<br/>Payload: { id, email, exp }
    Worker-->>Client: 3. Trả về Token và thông tin User
    Note over Client: 4. Lưu Token vào Memory State (React)
    
    Note over Client: Thực hiện request lấy dữ liệu
    Client->>Worker: 5. Gửi request kèm Header:<br/>Authorization: Bearer <Token>
    Note over Worker: 6. Giải mã & kiểm tra chữ ký<br/>bằng Secret Key & Check Hết hạn (exp)
    Worker->>DB: Thực hiện câu lệnh SQL dựa trên User ID giải mã được
    DB-->>Worker: Trả về kết quả (danh sách bạn bè, thông báo...)
    Worker-->>Client: 7. Trả về dữ liệu JSON
```

---

## 4. Phân tích mã nguồn áp dụng JWT trong dự án

### A. Sinh và ký Token (Backend)
Khi người dùng đăng ký tài khoản thành công (`/api/auth/register`) hoặc đăng nhập thành công (`/api/auth/login`), máy chủ Cloudflare Worker sẽ sinh ra mã JWT cấp cho client:

```typescript
// Trích xuất từ backend-cloudflare/src/index.ts
import { sign } from 'hono/jwt'

// 1. Cấu hình Secret Key và thời gian hết hạn (30 ngày)
const jwtSecret = c.env.JWT_SECRET || 'vivychat_jwt_secret_key'
const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 ngày từ hiện tại

// 2. Ký Token bằng thuật toán HS256 mặc định của thư viện Hono JWT
const token = await sign({ id: userId, email: cleanEmail, exp }, jwtSecret)

// 3. Trả về token cho Client
return c.json({
  message: 'Đăng nhập thành công.',
  token,
  user: { id: user.id, email: user.email, displayName: user.display_name }
})
```

### B. Lưu trữ và đính kèm Token (Frontend)
Sau khi nhận được token từ API phản hồi, Frontend React lưu trữ token trong component state và tự động đính kèm vào header `Authorization` cho các request sau:

```typescript
// Trích xuất từ frontend/src/App.tsx
const [token, setToken] = useState<string | null>(null);

// Gửi request lấy danh sách bạn bè kèm token
const fetchFriends = async () => {
  if (!token) return;
  const response = await fetch(`${BACKEND_URL}/api/friends`, {
    headers: { 
      'Authorization': `Bearer ${token}` // Chuẩn Bearer token
    }
  });
  // ...
};
```

---

## 5. Đánh giá Ưu và Nhược điểm của JWT trong dự án

### Ưu điểm:
- **Tốc độ tối ưu ở Edge Node**: Nhờ thư viện `hono/jwt` nhẹ và tối ưu hóa tính toán, việc xác thực diễn ra chỉ trong vài mili-giây trực tiếp tại Cloudflare Worker mà không cần bất kỳ lệnh `SELECT` nào đến Database D1 để tìm phiên đăng nhập.
- **Không tốn tài nguyên lưu trữ**: Không cần bảng `sessions` lưu trữ hàng triệu bản ghi rác gây tốn dung lượng ổ đĩa.
- **Dễ dàng tích hợp đa nền tảng**: Mã JWT là một chuỗi string tiêu chuẩn, do đó cả Web App (React) hay ứng dụng di động sau này (Flutter/React Native) đều dễ dàng sử dụng và truyền tải.

### Nhược điểm & Cách khắc phục:
- **Khó thu hồi Token tức thời**: Nếu người dùng đổi mật khẩu hoặc bị lộ token, token cũ vẫn có hiệu lực cho đến khi hết hạn (trong vòng 30 ngày).
  - *Cách khắc phục tương lai:* Áp dụng thêm cơ chế **AccessToken ngắn hạn** (ví dụ 15 phút) đi kèm với **RefreshToken dài hạn** lưu trữ trong D1 Database/KV để dễ dàng thu hồi khi cần.

---

## 📚 Tóm tắt bài học
* **JWT** là giải pháp xác thực không trạng thái (Stateless), hoàn hảo cho mô hình Cloudflare Workers/Edge Computing.
* Token gồm 3 phần: **Header** (khai báo thuật toán), **Payload** (chứa thông tin người dùng được mã hóa Base64Url), và **Signature** (chữ ký số dùng Secret Key để xác thực tính toàn vẹn).
* Không bao giờ để thông tin nhạy cảm (như mật khẩu) trong Payload vì bất cứ ai cũng giải mã được.
* Client gửi JWT qua HTTP header `Authorization: Bearer <token>` để thực hiện truy cập các tài nguyên bảo mật.
