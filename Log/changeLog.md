# Nhật Ký Thay Đổi (Log/changeLog.md)

Tài liệu này lưu trữ lịch sử thay đổi tổng quát của dự án **VivyChat** qua các giai đoạn phát triển.

---

## [2026-06-04] - Xác thực & Cài đặt Không gian làm việc (Phase 1)

### Thêm mới (Added)
*   Khởi tạo bảng cơ sở dữ liệu `users` trên Cloudflare D1 local qua file migration.
*   Cài đặt và cấu hình TypeScript, TailwindCSS, và React cho thư mục `/frontend`.
*   Tạo trang Đăng nhập (`Login.tsx`), Đăng ký với ô nhập OTP và đếm ngược (`Register.tsx`), màn hình thành công (`App.tsx`) và hệ thống thông báo (`Toast.tsx`).
*   Tích hợp màn hình cảnh báo khóa OTP lớn (`Register.tsx`) kèm nút quay lại Đăng nhập khi nhập sai OTP quá 5 lần liên tiếp.
*   Viết logic băm mật khẩu bảo mật PBKDF2 bằng Web Crypto API và bộ Rate Limiter bằng KV sliding window cho backend Hono.
*   Cấu hình D1, KV và biến môi trường local `.dev.vars`.

### Thay đổi (Changed)
*   Cập nhật thông tin nhận dạng dự án từ `aero-verify`/`account-manager-backend` sang `vivychat-backend` trong wrangler.toml, package.json và package-lock.json.
*   Dọn dẹp các tệp tin script cũ không sử dụng của frontend.

---

## [2026-06-04] - Khởi Tạo & Thiết Kế Kiến Trúc (Phase 0)

### Thêm mới (Added)
*   Tạo tài liệu thiết kế phần mềm chi tiết: [docs/sdd_realtime_chat.md] bao gồm:
    *   Đặc tả yêu cầu chức năng & phi chức năng.
    *   Sơ đồ kiến trúc Durable Objects & WebSockets phân tách (`ConversationDO` & `UserPresenceDO`).
    *   Thiết kế database SQLite trên Cloudflare D1.
    *   Thiết kế luồng hoạt động (Sequence Diagrams) bằng Mermaid cho đăng ký, kết nối trực tuyến, nhắn tin, gửi file qua R2 + Virus Scan Queue, và phân trang.
    *   API Endpoints và Wireframe giao diện.
    *   Kế hoạch 6 giai đoạn chi tiết.
*   Cập nhật bộ quy tắc kiến trúc chung dành cho lập trình viên/AI Agent: [AGENT.md] thay thế cho phiên bản xác thực OTP cũ.
*   Tạo tài liệu quy trình phát triển và vận hành dự án: [CLAUDE.md] mô tả cách chạy dev, migrations D1, deploy Workers và quy ước coding/commits.
*   Tạo thư mục [Log/] chứa báo cáo chi tiết theo từng giai đoạn và lịch sử thay đổi.
