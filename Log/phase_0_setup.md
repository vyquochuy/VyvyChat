# Nhật Ký Phát Triển - Phase 0: Thiết Kế Kiến Trúc (Log/phase_0_setup.md)

*   **Trạng thái**: Đã hoàn thành (Completed)
*   **Thời gian thực hiện**: 2026-06-04
*   **Người thực hiện**: AI Architect & Lead Developer

---

## 1. Công Việc Đã Hoàn Thành (What's Done)

1.  **Nghiên cứu & Thiết kế Hệ thống**:
    *   Xác định các thành phần cốt lõi của ứng dụng nhắn tin realtime sử dụng hạ tầng Cloudflare.
    *   Thiết lập cơ chế phân tách Durable Objects giữa `ConversationDO` (phục vụ room chat) và `UserPresenceDO` (phục vụ trạng thái online/offline thời gian thực) để tăng khả năng chịu tải và giảm độ trễ đồng bộ.
2.  **Thiết kế Database (D1)**:
    *   Xác định cấu trúc 8 bảng lưu trữ chính bao gồm: `Users`, `Friendships`, `Conversations`, `ConversationMembers`, `Messages`, `MessageReactions`, `Attachments`, và `Notifications`.
    *   Quy định kiểu dữ liệu UUID/ULID cho các trường khóa chính để đáp ứng đặc thù phân tán của cơ sở dữ liệu D1 ở biên.
3.  **Tích hợp Bảo Mật & Giới Hạn Tần Suất**:
    *   Thiết lập luồng quét virus bất đồng bộ (`Virus Scan Queue`) cho việc chia sẻ tệp tin qua Cloudflare R2 và Queue.
    *   Đưa ra các chính sách giới hạn tần suất cụ thể cho từng API nhạy cảm (Auth, OTP, Message, Upload).
4.  **Thiết lập Guideline Phát triển**:
    *   Tạo file [AGENT.md] lưu trữ các quy tắc kiến trúc bắt buộc để đảm bảo bất kỳ AI Agent nào tham gia phát triển cũng không vi phạm cấu trúc hệ thống.
    *   Tạo file [CLAUDE.md] lưu trữ tài liệu quy trình phát triển, các tập lệnh chạy dev, quy trình migrate database D1, commit convention và coding convention.

---

## 2. Kế Hoạch Tiếp Theo (Next Steps)

*   **Bắt đầu Phase 1: Authentication & Setup Workspace**
    *   Cài đặt cấu trúc thư mục monorepo mới cho phần `/frontend` sử dụng React + TypeScript thay thế cho Vanilla JS hiện tại.
    *   Cấu hình Wrangler cho backend: Khởi tạo database D1 local và đồng bộ các thiết lập biến môi trường.
    *   Viết mã nguồn Hono API cho luồng đăng ký, gửi OTP (sử dụng lại và nâng cấp tính năng cũ) và đăng nhập bằng mật khẩu băm bảo mật.
