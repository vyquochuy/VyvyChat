# Chuyên Đề 2: Hono Framework - Web Framework Siêu Nhẹ Cho Môi Trường Edge

Nếu bạn đã từng làm việc với Node.js, chắc chắn bạn biết đến **Express.js** - framework quốc dân để làm API. Tuy nhiên, Express.js được thiết kế từ cách đây hơn 10 năm, nặng nề và dựa trên các thư viện đặc thù của Node.js. 

Khi chạy trên môi trường Edge tiên tiến như Cloudflare Workers (không có đầy đủ môi trường runtime của Node.js mà chạy trên V8 tiêu chuẩn), chúng ta cần một framework chuyên dụng khác: **Hono**.

---

## 1. Hono là gì?

> [!TIP]  
> Trong tiếng Nhật, **Hono (炎)** nghĩa là "Ngọn lửa". Đây là một web framework cực nhanh, cực nhỏ gọn và được viết hoàn toàn bằng TypeScript.

Điểm đặc biệt của Hono là nó tuân thủ các tiêu chuẩn Web Standard (như `Request`, `Response`, `fetch` API chuẩn của trình duyệt) nên nó có thể chạy ở **bất kỳ đâu**: Cloudflare Workers, Deno, Bun, Lagon, Fastly Compute, hay thậm chí cả Node.js truyền thống.

---

## 2. So sánh Hono vs Express.js

| Đặc Tính | Express.js | Hono |
|---|---|---|
| **Dung lượng (Bundle Size)** | ~ Khá nặng, phụ thuộc nhiều thư viện con | Siêu nhẹ (~ 14KB), không phụ thuộc bên ngoài |
| **Hỗ trợ TypeScript** | Cần cài thêm `@types/express` và cấu hình phức tạp | Hỗ trợ tuyệt đối mặc định (First-class citizen) |
| **Môi trường chạy (Runtime)** | Chỉ chạy được trên Node.js | Chạy ở mọi nơi (Cloudflare Workers, Bun, Deno...) |
| **Tốc độ định tuyến (Router)** | Chậm hơn do dùng Regex truyền thống | Cực nhanh nhờ thuật toán tối ưu hóa cây đường dẫn (Radix Tree Router) |

---

## 3. Cách Hono hoạt động trong dự án của chúng ta

Hãy nhìn vào cách chúng ta khởi tạo app trong file `backend-cloudflare/src/index.ts`:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Khởi tạo app Hono với các cấu hình kiểu dữ liệu (TypeScript)
const app = new Hono<{ Bindings: Bindings }>()
```

### Các thành phần chính của Hono được áp dụng:

### A. Routing (Định tuyến đường dẫn)
Hono giúp chúng ta chia các chức năng ra thành các đường dẫn API rõ ràng bằng cách lắng nghe các phương thức HTTP như `GET`, `POST`:

```typescript
// Lắng nghe yêu cầu POST gửi tới đường dẫn /api/auth/send-otp
app.post('/api/auth/send-otp', async (c) => { ... })

// Lắng nghe yêu cầu POST gửi tới đường dẫn /api/auth/verify-otp
app.post('/api/auth/verify-otp', async (c) => { ... })
```

### B. Request Context (`c`)
Trong Express, bạn thường viết `(req, res)`. Trong Hono, hai đối tượng này được gộp chung vào một đối tượng duy nhất là **Context**, ký hiệu là `c`.
- Để lấy dữ liệu JSON gửi lên từ client: `const body = await c.req.json()`
- Để lấy biến môi trường từ Cloudflare KV hoặc Secrets: `c.env.OTP_KV`
- Để trả dữ liệu về cho Client dưới dạng JSON kèm HTTP Status Code:
  ```typescript
  return c.json({ message: 'OTP sent successfully' }, 200)
  ```

### C. Middleware (Phần mềm trung gian)
Hono cung cấp các middleware tích hợp sẵn rất mạnh mẽ. Ví dụ, để ứng dụng Flutter hoặc Web của bạn có thể gọi được API mà không bị lỗi bảo mật của trình duyệt, chúng ta cần bật tính năng **CORS** (Xem chi tiết ở chuyên đề 6):

```typescript
app.use('*', cors({
  origin: '*', // Cho phép tất cả các nguồn gọi tới API này
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}))
```

---

## 📚 Tóm tắt bài học
* **Hono** là ngọn lửa cung cấp sức mạnh cho backend Edge nhờ tốc độ siêu nhanh và kích thước siêu gọn nhẹ.
* Hono sử dụng đối tượng **Context (`c`)** giúp quản lý request, response và biến môi trường vô cùng gọn gàng và khoa học.
* Khả năng tương thích hoàn hảo với **TypeScript** giúp hạn chế tối đa các lỗi vặt trong quá trình viết code API.
