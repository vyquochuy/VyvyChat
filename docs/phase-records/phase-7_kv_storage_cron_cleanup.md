# Báo cáo Kết quả Thực hiện Di chuyển Storage sang KV & Tự động Dọn dẹp - Phase 7

Báo cáo này tổng hợp kết quả của quá trình chuyển đổi kiến trúc lưu trữ từ Cloudflare R2 sang Cloudflare KV, chuẩn hóa cấu trúc dữ liệu cơ sở dữ liệu D1, và triển khai hệ thống dọn dẹp tin nhắn & tệp đính kèm tự động chạy qua Cron Trigger sau 30 ngày.

---

## 🚀 Các công việc đã hoàn thành (Achievements)

### 1. Thay thế Cloudflare R2 bằng Cloudflare KV (`MEDIA_KV`)
Để giải quyết rào cản về việc kích hoạt tài khoản thanh toán R2 trên gói Cloudflare Workers Free, chúng tôi đã chuyển dịch toàn bộ kiến trúc lưu trữ tệp đính kèm sang **Cloudflare KV**:
* **Khởi tạo Namespace**: Tạo thành công KV Namespace `MEDIA_KV` (`eadf064bbf954f80b31cd79270c8bce8`).
* **Hạn mức Tải lên An sau**: Thay đổi các cấu hình kích thước file giới hạn tối đa trên cả Frontend và Backend về mức **15MB** (đảm bảo tệp đính kèm luôn nằm dưới giới hạn 25MB của mỗi key trên Cloudflare KV).
* **Luồng Stream File**: API `/upload` ghi trực tiếp dữ liệu tệp vào KV (kèm metadata `mimeType` và `sha256`), và API `/download` sử dụng `MEDIA_KV.getWithMetadata(key, { type: 'stream' })` để phản hồi luồng stream trực tiếp về client với đúng `Content-Type` được lưu trữ.

### 2. Chuẩn hóa & Khởi tạo lại Cơ sở dữ liệu (Schema Future-proofing)
* **Độc lập hóa cột lưu trữ**: Đổi tên trường `r2_key` trong bảng `attachments` thành `storage_key` trong migration [0005_create_attachments_table.sql](file:///c:/Game/Email-Verify/backend-cloudflare/migrations/0005_create_attachments_table.sql) và toàn bộ các controller, store của hệ thống. Thay đổi này giúp hệ thống sẵn sàng hoán đổi bất kỳ loại Storage nào (R2, KV, S3...) trong tương lai mà không cần cấu trúc lại Database.
* **Tái thiết lập D1 Dev**: Thực hiện drop sạch sẽ các bảng trên cơ sở dữ liệu D1 dev và chạy lại bộ migrations để có cấu trúc dữ liệu sạch.

### 3. Tối ưu hóa Quét virus (Virus Scan Queue)
* Sử dụng `env.MEDIA_KV.get(key, { type: 'arrayBuffer' })` trong hàng đợi Worker tiêu thụ [queue.ts](file:///c:/Game/Email-Verify/backend-cloudflare/src/queue.ts), lấy 8 byte đầu tiên qua `Uint8Array.slice(0, 8)` để xác thực Magic Bytes mà không làm tràn bộ nhớ RAM.
* Nếu tệp bị nhiễm virus (`scanStatus === 'INFECTED'`), tệp sẽ bị xóa lập tức khỏi KV và bản ghi attachment tương ứng trong D1 cũng bị xóa sạch để tránh rác dữ liệu.

### 4. Triển khai Cron Job tự động dọn dẹp sau 30 ngày
Hệ thống dọn dẹp tự động chạy mỗi ngày lúc 00:00 (qua trigger `0 0 * * *` được cấu hình trong `wrangler.toml`):
* **Tính toán dựa trên Message Age**: Truy vấn các `storage_key` cần xóa từ attachments dựa trên `JOIN` với bảng `messages` có tuổi đời vượt quá 30 ngày để đảm bảo tính nhất quán (tránh xóa nhầm tệp đính kèm mới gửi).
* **Xóa KV theo lô (Chunked Delete)**: Tiến hành xóa tệp khỏi KV theo các lô 100 key song song sử dụng `Promise.all` giúp tối ưu hóa thời gian thực thi của Worker.
* **Xóa D1 bằng Transaction Batch**: Thực hiện lệnh xóa bảng `attachments` và `messages` trong `env.DB.batch` để đảm bảo tính nguyên tử (Atomicity).

---

## 🛠️ Công nghệ & Thư viện sử dụng (Tech Stack)

* **Cloudflare Workers KVNamespace**: Sử dụng lưu trữ nhị phân và siêu dữ liệu (metadata) tùy chỉnh.
* **D1 Transaction Batch**: Dùng `env.DB.batch` để thực hiện giao dịch SQL an toàn biên.
* **Wrangler Cron Triggers**: Lập lịch chạy cho các tác vụ nền.
* **Type-safety**: Tích hợp các kiểu `ScheduledEvent` và `ExecutionContext` từ `@cloudflare/workers-types`.

---

## 💡 Kiến thức đúc kết (Lessons Learned)

1. **Khắc phục hạn chế của KV**: Cloudflare KV không hỗ trợ lấy dữ liệu theo khoảng (range read) như R2. Vì vậy, để đọc Magic Bytes kiểm tra file, bắt buộc phải tải toàn bộ file về dạng `arrayBuffer` rồi `slice`. Do giới hạn file là 15MB, cách này vẫn hoạt động ổn định và không làm tràn bộ nhớ isolate (128MB).
2. **Quản lý dữ liệu mồ côi**: Không dùng `expirationTtl` trên KV để tránh tình trạng tệp tin tự biến mất trước khi tin nhắn bị xóa. Toàn bộ vòng đời của tin nhắn, bản ghi DB và tệp đính kèm đều được đồng bộ hóa và quản lý bởi Cron Job.

---

## 📊 Kết quả Triển khai & Kiểm thử (Build & Deploy Status)

* **Compile & TypeScript**: Hoàn thành type-check sạch sẽ cho cả Frontend và Backend.
* **Wrangler Deploy**: Deployed thành công Worker:
  * Route: `https://vivychat-backend.myvault-service.workers.dev`
  * Cron trigger: `0 0 * * *` (Daily)
