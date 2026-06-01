# Chuyên Đề 3: Cloudflare KV (Key-Value Store) - Cơ Sở Dữ Liệu Ở Vùng Biên

Mọi ứng dụng web đều cần cơ sở dữ liệu (Database) để lưu trữ thông tin. Với các hệ thống truyền thống, bạn thường sử dụng SQL (MySQL, PostgreSQL) hoặc NoSQL (MongoDB). 

Tuy nhiên, khi backend của chúng ta chạy trên **Cloudflare Workers** (chạy phân tán ở hơn 300 thành phố trên thế giới), nếu chúng ta dùng một database tập trung đặt ở một nơi duy nhất, tốc độ sẽ bị kéo chậm lại đáng kể. 

Đó là lý do Cloudflare thiết kế ra **Cloudflare KV (Key-Value)**.

---

## 1. Cloudflare KV là gì?

> [!NOTE]  
> **Key-Value Store (Lưu trữ khóa-giá trị)** là kiểu cơ sở dữ liệu NoSQL đơn giản nhất. Dữ liệu được lưu dưới dạng một cặp bài trùng gồm: **Khóa (Key)** duy nhất và **Giá trị (Value)** đi kèm. Nó giống như một cuốn từ điển khổng lồ, tra từ (Key) là ra định nghĩa (Value).

Ví dụ trong dự án của chúng ta:
- **Key (Khóa):** Email của người dùng (ví dụ: `vyquochuy@gmail.com`)
- **Value (Giá trị):** Chuỗi mã OTP đã được băm mã hóa (ví dụ: `8c6976e5b5410415bde9...`)

---

## 2. Đặc điểm kỹ thuật quan trọng của Cloudflare KV

### A. Tốc độ đọc siêu tốc (Lightning-fast Reads)
Dữ liệu lưu trong KV được Cloudflare tự động nhân bản (cache) ra toàn bộ hệ thống máy chủ biên toàn thế giới. Khi người dùng gọi API để xác thực OTP, dữ liệu KV được lấy trực tiếp từ trung tâm dữ liệu gần người dùng nhất trong chưa đầy 10ms.

### B. Tính nhất quán trễ (Eventual Consistency)
*Vì dữ liệu được nhân bản ra toàn cầu, nên khi bạn vừa ghi dữ liệu mới ở Việt Nam, máy chủ ở Mỹ có thể mất từ vài giây đến một phút để cập nhật được sự thay đổi đó.*
- KV được tối ưu hóa cho các ứng dụng **Đọc nhiều - Ghi ít** (Read-heavy, Write-few).
- **Ví dụ phù hợp:** Lưu cấu hình ứng dụng, lưu session đăng nhập, lưu mã OTP tạm thời...
- **Ví dụ KHÔNG phù hợp:** Làm hệ thống giao dịch ngân hàng cần tính chính xác tức thì từng mili-giây (cho trường hợp này, Cloudflare có công nghệ khác gọi là *Durable Objects* hoặc *Cloudflare D1*).

### C. Cơ chế tự hủy TTL (Time To Live)
Đây là tính năng "vàng" giúp Cloudflare KV cực kỳ thích hợp để lưu mã OTP xác thực:
- **TTL (Time to Live)** là thời hạn tồn tại của một cặp Key-Value. Sau khi hết thời gian này, Cloudflare sẽ tự động xóa sạch dữ liệu đó khỏi bộ nhớ mà bạn không cần viết code để dọn dẹp.
- Quy định tối thiểu của Cloudflare KV: TTL phải từ **60 giây** trở lên.

---

## 3. Cách KV được sử dụng trong dự án Email-Verify

Hãy phân tích luồng xử lý mã OTP trong file `backend-cloudflare/src/index.ts`:

### Bước 1: Lưu mã OTP vào KV kèm thời hạn 5 phút (300 giây)
Khi người dùng bấm gửi OTP, sau khi băm mã, ta lưu vào KV:

```typescript
// c.env.OTP_KV là Binding để kết nối với cơ sở dữ liệu KV cấu hình trong wrangler.toml
// { expirationTtl: 300 } nghĩa là sau 300 giây (5 phút), mã OTP này tự biến mất!
await c.env.OTP_KV.put(email, otpHash, { expirationTtl: 300 })
```

### Bước 2: Truy xuất mã OTP để đối chiếu
Khi người dùng nhập OTP gửi lên để xác thực, ta lấy dữ liệu từ KV ra:

```typescript
const savedHash = await c.env.OTP_KV.get(email)

if (!savedHash) {
  // Nếu đã quá 5 phút, hoặc email chưa từng yêu cầu gửi OTP -> savedHash sẽ là null
  return c.json({ detail: 'Invalid or expired OTP.' }, 400)
}
```

### Bước 3: Bảo mật tuyệt đối - Xóa ngay sau khi xác thực thành công
Mã OTP chỉ được dùng **một lần duy nhất** (One-Time Password). Để tránh việc hacker chặn được gói tin và gửi lại mã đó lần thứ hai (Replay Attack), ta xóa nó khỏi KV ngay lập tức khi kiểm tra khớp:

```typescript
// Xóa dữ liệu khỏi KV
await c.env.OTP_KV.delete(email)
```

---

## 📚 Tóm tắt bài học
* **Cloudflare KV** là database NoSQL dạng Key-Value phân tán toàn cầu, lý tưởng cho tốc độ đọc siêu tốc ở biên.
* Tính năng **TTL** (Time To Live) cho phép thiết lập thời gian tự hủy dữ liệu, cực kỳ phù hợp cho các dữ liệu tạm thời như mã OTP.
* Luôn tuân thủ nguyên tắc xóa khóa OTP (`.delete`) ngay sau khi xác thực thành công để bảo đảm an toàn hệ thống.
