# Chuyên Đề 4: Security & Cryptography (Bảo Mật & Mã Hóa) - Bảo Vệ Mã OTP Của Người Dùng

Mã OTP (One-Time Password) là chốt chặn cuối cùng để xác thực danh tính người dùng trước khi thực hiện các hành động nhạy cảm (đăng nhập, đổi mật khẩu, giao dịch). 

Vì vậy, bảo mật cho mã OTP là ưu tiên hàng đầu. Trong dự án này, chúng ta áp dụng các nguyên lý mã hóa hiện đại nhằm đảm bảo an toàn tuyệt đối.

---

## 1. Mối nguy hiểm của việc lưu trữ Plain-text (Văn bản thuần túy)

Giả sử chúng ta sinh ra mã OTP là `123456` rồi lưu thẳng số `123456` này vào Database (Cloudflare KV). Điều gì sẽ xảy ra nếu:
- Cơ sở dữ liệu bị lộ lọt (Data leak).
- Một quản trị viên hệ thống có quyền truy cập vào KV Dashboard và nhìn thấy toàn bộ mã OTP đang hiển thị.
- Kẻ tấn công thực hiện kỹ thuật sniffing (nghe lén) bộ nhớ đệm.

Họ sẽ lập tức có được mã OTP hoạt động và chiếm đoạt tài khoản dễ dàng. Do đó, **nguyên tắc vàng trong bảo mật thông tin là: Không bao giờ lưu trữ thông tin xác thực nhạy cảm dưới dạng Plain-text.**

---

## 2. Giải pháp: Thuật toán băm SHA-256 là gì?

Để bảo vệ mã OTP, chúng ta sử dụng phương pháp **Băm dữ liệu (Hashing)** bằng thuật toán **SHA-256** (Secure Hash Algorithm 256-bit).

> [!IMPORTANT]  
> **Hàm băm (Hash Function)** là hàm toán học một chiều biến đổi một thông điệp có độ dài bất kỳ thành một chuỗi kết quả có độ dài cố định (đối với SHA-256 là 64 ký tự hệ thập lục phân).

### Các tính chất tối quan trọng của hàm băm:
1. **Tính chất một chiều (One-Way):** Bạn dễ dàng băm từ `123456` thành `8c6976e5b5410415bde9...` nhưng **không thể** làm ngược lại để dịch chuỗi băm đó ra số `123456`. Kẻ tấn công dù có lấy được chuỗi băm trong database cũng vô tác dụng.
2. **Tính chất cố định (Deterministic):** Cùng một số `123456` băm ở bất kỳ máy tính nào, bất kỳ thời điểm nào cũng sẽ cho ra một chuỗi băm duy nhất giống hệt nhau.
3. **Hiệu ứng thác đổ (Avalanche Effect):** Chỉ cần thay đổi 1 li nhỏ ở đầu vào (ví dụ `123457`), chuỗi băm đầu ra sẽ thay đổi hoàn toàn khác biệt không liên quan gì chuỗi cũ.
4. **Chống trùng lặp (Collision Resistance):** Thực tế không thể tìm thấy hai đầu vào khác nhau cùng cho ra một chuỗi băm đầu ra giống nhau.

---

## 3. Web Crypto API trên Cloudflare Workers

Thông thường, ở Node.js bạn phải cài đặt các thư viện nặng như `bcrypt`, `crypto-js` hoặc dùng module `crypto` có sẵn. Tuy nhiên, trên Cloudflare Workers, chúng ta sử dụng **Web Crypto API** - một bộ tiêu chuẩn bảo mật chính thức của W3C chạy trực tiếp trên các trình duyệt hiện đại và môi trường Edge Server với tốc độ cực nhanh vì được tối ưu ở mức phần cứng.

Hãy xem đoạn code băm mã OTP trong `backend-cloudflare/src/index.ts`:

```typescript
// 1. Chuyển chuỗi OTP "123456" thành dạng mảng nhị phân Uint8Array
const encoder = new TextEncoder()
const data = encoder.encode(otpCode)

// 2. Sử dụng Web Crypto API để băm SHA-256
// Hàm crypto.subtle.digest là hàm bất đồng bộ chạy ở tầng nền cực kỳ an toàn
const hashBuffer = await crypto.subtle.digest('SHA-256', data)

// 3. Chuyển kết quả Buffer nhị phân về chuỗi Hexadecimal dài 64 ký tự để lưu trữ
const hashArray = Array.from(new Uint8Array(hashBuffer))
const otpHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
```

---

## 4. Các cơ chế bảo mật bổ sung trong dự án

Ngoài việc băm SHA-256, dự án còn tích hợp các biện pháp bảo vệ quan trọng khác:

### A. Ngăn chặn Replay Attack (Tấn công lặp lại)
Khi người dùng xác thực thành công, Worker lập tức xóa mã OTP khỏi database:
```typescript
await c.env.OTP_KV.delete(email)
```
Điều này đảm bảo mã OTP chỉ có giá trị sử dụng **ĐÚNG MỘT LẦN**. Nếu kẻ tấn công chặn được mã và cố gửi lại yêu cầu xác thực lần thứ 2, hệ thống sẽ từ chối ngay vì mã đã bị xóa sạch.

### B. Rate Limiting (Giới hạn tần suất gửi)
Hệ thống giới hạn thời gian gửi lại mã OTP (ví dụ 60 giây một lần). Điều này ngăn chặn việc kẻ xấu viết công cụ tự động gửi hàng triệu email spam (Brute Force hoặc Spam Email) gây quá tải hệ thống và làm cạn kiệt tài khoản gửi email của bạn.

---

## 📚 Tóm tắt bài học
* Không bao giờ lưu trữ mật khẩu hay mã OTP dạng thô. Luôn băm trước khi lưu.
* **SHA-256** là hàm băm một chiều cực kỳ an toàn, không thể dịch ngược chuỗi băm để tìm lại mã gốc.
* Sử dụng **Web Crypto API** chuẩn giúp mã nguồn chạy siêu tốc, bảo mật tối đa và tương thích tốt trên môi trường Edge.
* Cơ chế xóa OTP ngay sau khi xác thực là chốt chặn vững chắc chống lại **Replay Attack**.
