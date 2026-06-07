# Tài Liệu Kỹ Thuật Phase 5: Chia Sẻ Tệp Đa Phương Tiện & Quét Mã Độc

Tài liệu này tổng hợp các công nghệ, thuật toán, quyết định thiết kế kiến trúc và bài học kinh nghiệm tích lũy sau khi hoàn thành Phase 5 của dự án **VivyChat** (Lưu trữ và truyền tải tệp đính kèm qua Cloudflare R2, quét mã độc bất đồng bộ qua Cloudflare Queues, xác thực magic bytes ngầm và cải tiến giao diện hiển thị).

---

## 1. Công Nghệ & Framework (Technologies & Frameworks)

*   **Cloudflare R2 Bucket**:
    *   Hệ thống lưu trữ đối tượng tương thích với S3 của Cloudflare nhưng tối ưu ở điểm **Không tính phí băng thông tải về (Zero Egress Fees)**.
    *   Giúp dự án tiết kiệm đến 90% chi phí vận chuyển file so với AWS S3 truyền thống khi người dùng liên tục tải tệp tin và xem ảnh đính kèm.
*   **Cloudflare Queues**:
    *   Hệ thống hàng đợi thông điệp serverless giúp truyền tin an toàn, bất đồng bộ (Asynchronous message queue) giữa các thành phần.
    *   Được sử dụng làm **Security Pipeline**: Nhận các tác vụ chứa khóa tệp mới tải lên, kích hoạt Worker quét độc chạy ngầm để tránh gây trễ hoặc block luồng tương tác chính của người dùng.
*   **Web Crypto API (`crypto.subtle`)**:
    *   Bộ thư viện mật mã học chuẩn của trình duyệt và V8 Worker runtime.
    *   Sử dụng để tính toán mã băm SHA-256 của tệp ở Client, và ký số xác thực HMAC-SHA256 cho proxy URL.
*   **Worker Stream Proxy**:
    *   Sử dụng Hono Router kết hợp trực tiếp với luồng dữ liệu thô (`Request.body` dạng `ReadableStream`) để lưu tệp tin trực tiếp vào R2 thông qua liên kết biên.

---

## 2. Thuật Toán & Lý Thuyết (Algorithms & Theories)

### 2.1. Worker-based Stream Proxy (Chuyển tiếp luồng dữ liệu)
Để tránh các vấn đề phình to bundle size, tốn chi phí cold start của AWS SDK, và tránh lộ lọt credentials S3, chúng ta sử dụng cơ chế Worker Proxy để upload trực tiếp:
1. **Lấy Token ngắn hạn**: Client gọi `POST /api/media/upload-url`, Worker kiểm tra dung lượng và rate limit (50 tệp/giờ), sau đó sinh mã token HMAC-SHA256 chứa thông tin `key`, `size`, `sha256` và thời gian hết hạn (15 phút).
2. **Streaming qua Worker**: Client thực hiện `PUT` lên `/api/media/upload?key=xxx&token=yyy`.
3. **Tiết kiệm RAM**: Hono đọc `c.req.raw.body` (đang là một `ReadableStream` nhận dữ liệu từ card mạng) và truyền thẳng vào `env.MEDIA_BUCKET.put(key, body)` mà không lưu toàn bộ tệp vào RAM của Worker. Điều này cho phép tải các file lớn tới 100MB mà chỉ tiêu tốn < 10MB RAM của Worker.

### 2.2. Kỹ thuật Quét Magic Bytes (File Signature Verification)
User hoàn toàn có thể thay đổi phần mở rộng của file độc hại (ví dụ đổi `malware.exe` thành `tailieu.pdf`) nhằm vượt qua các bộ lọc đuôi file ở Client.
*   **Giải pháp**: Trong Queue Consumer (Virus Scanner), thay vì tải toàn bộ tệp tin lớn về bộ nhớ để quét (gây tràn RAM Worker), hệ thống thực hiện một **Range Request** đến R2 để chỉ tải đúng **8 byte đầu tiên**:
    ```typescript
    const r2Object = await env.MEDIA_BUCKET.get(r2Key, { range: { offset: 0, length: 8 } });
    ```
*   **Kiểm tra tính nhất quán**: So sánh 8 byte này với tập hợp các mã băm Magic Bytes chuẩn (File Signatures):
    *   **PNG**: `89 50 4E 47` (`[137, 80, 78, 71]`)
    *   **JPEG/JPG**: `FF D8 FF` (`[255, 218, 255]`)
    *   **PDF**: `%PDF` -> `25 50 44 46` (`[37, 80, 68, 70]`)
    *   **ZIP**: `PK\x03\x04` -> `50 4B 03 04` (`[80, 75, 3, 4]`)
*   Nếu phát hiện định dạng khai báo (MIME Type) không trùng khớp với chữ ký byte thực tế, hoặc tên file chứa từ khóa độc hại, tệp tin lập tức bị đánh dấu `INFECTED` và xóa vĩnh viễn khỏi R2.

### 2.3. Băm SHA-256 Checksum phía Client
*   Sử dụng Web Crypto API trong React Component để tính mã SHA-256 của file trước khi gửi yêu cầu upload:
    ```typescript
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    ```
*   Giúp bảo vệ tính toàn vẹn của tệp và tạo tiền đề triển khai giải pháp **Deduplication** (nếu tệp tin trùng mã băm đã tồn tại trên R2, hệ thống chỉ cần tham chiếu đường dẫn cũ mà không cần upload lại).

### 2.4. Quan hệ 1-N (1 Message - N Attachments)
*   Để hỗ trợ gửi nhiều ảnh/tệp cùng lúc trong một tin nhắn chat sau này, tệp đính kèm được tách hẳn sang một bảng dữ liệu riêng (`attachments`), liên kết ngược lại bảng `messages` qua khóa ngoại `message_id`.
*   Khi truy vấn lịch sử hoặc đồng bộ tin nhắn qua WebSocket, hệ thống thực hiện gộp nhóm bằng cách thực thi truy vấn phụ `IN (ids)` để kéo toàn bộ attachments của các tin nhắn trong một batch chỉ với 2 câu lệnh SQL, tránh lỗi N+1 query.

---

## 3. Thư Viện & Công Cụ (Libraries & Tools)

*   **XMLHttpRequest (XHR)**:
    *   Sử dụng XHR thay vì Fetch API trên Frontend React để lắng nghe sự kiện `xhr.upload.onprogress`.
    *   Giúp cập nhật tiến độ tải lên (phần trăm hoàn thành) theo thời gian thực trực quan cho người dùng.
*   **Wrangler Queue Local Emulator**:
    *   Công cụ giả lập queue cục bộ của Wrangler v3 giúp chạy và test bất đồng bộ Queue Consumer ngay dưới máy cá nhân.

---

## 4. Kiến Thức Đúc Kết (Key Takeaways & Lessons Learned)

### 4.1. Nhận biết và tránh lỗi tiêu thụ Stream (Consumed Stream Error)
*   Trong V8 Engine của Cloudflare Workers, đối tượng `Request.body` là một `ReadableStream` chỉ được phép đọc duy nhất một lần (One-shot consumption).
*   Nếu chúng ta gọi `await request.arrayBuffer()` để phân tích Magic Bytes trước khi upload, stream sẽ bị đánh dấu là "đã tiêu thụ" và lệnh `MEDIA_BUCKET.put(key, request.body)` sẽ trả về lỗi.
*   **Bài học**: Hãy ghi thẳng dữ liệu thô vào R2 trước bằng stream. Việc phân tích Magic Bytes và quét virus sẽ được chuyển sang hàng đợi Queue chạy ngầm. R2 hỗ trợ truy xuất theo Range cực nhanh giúp tối ưu chi phí đọc tệp.

### 4.2. Cấu hình CORS mở rộng cho custom HTTP methods
*   Khi tích hợp upload tệp thông qua XHR của trình duyệt, chúng ta chuyển từ phương thức `POST` sang `PUT`.
*   Mặc định cấu hình CORS trong Hono chỉ cho phép `['GET', 'POST', 'OPTIONS']` khiến trình duyệt báo lỗi preflight CORS error khi gửi `PUT`.
*   **Khắc phục**: Luôn nhớ bổ sung `PUT`, `DELETE` vào mảng `allowMethods` trong global CORS middleware khi làm việc với API tải lên và thu hồi tệp.
