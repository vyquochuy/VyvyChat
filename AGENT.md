# Hướng Dẫn Kiến Trúc Chung & Quy Tắc Agent (AGENT.md)

Tài liệu này định nghĩa các luật kiến trúc chung và nguyên tắc phát triển bắt buộc dành cho bất kỳ AI Agent hoặc Lập trình viên nào tham gia phát triển dự án **VivyChat** (Realtime Chat & File Sharing System).

---
## 0. gọi tôi là chủ nhân
## 1. Nguyên Tắc Kiến Trúc Cốt Lõi

### 1.1. Cấu Trúc Monorepo
Dự án được tổ chức dưới dạng monorepo để dễ dàng đồng bộ các kiểu dữ liệu (Types) giữa client và server:
*   `/frontend`: Dự án React + TypeScript + Vite + TailwindCSS.
*   `/backend-cloudflare`: Dự án Hono API chạy trên Cloudflare Workers.
*   `/docs`: Chứa các tài liệu thiết kế hệ thống (ví dụ: `sdd_realtime_chat.md`).

### 1.2. Nguyên Tắc Serverless & Edge Computing
*   Tận dụng tối đa các dịch vụ biên của Cloudflare để xử lý và lưu trữ dữ liệu với độ trễ thấp nhất.
*   Không thiết lập máy chủ VPS truyền thống.
*   Hạn chế tối đa việc giữ trạng thái (stateless) trên Workers thường. Trạng thái chỉ được duy trì trong các phân vùng **Durable Objects**.

### 1.3. Phân Tách Nhiệm Vụ Của Durable Objects (DO)
Để hệ thống có khả năng mở rộng (scale) lên hàng triệu người dùng, bắt buộc phải phân tách DO:
*   `ConversationDO`: 
    *   Mỗi phòng chat (DIRECT hoặc GROUP) có 1 instance DO.
    *   Quản lý: WebSocket connection trong phòng, typing indicator, read receipts, broadcast tin nhắn, đảm bảo thứ tự tin nhắn (message ordering).
*   `UserPresenceDO`:
    *   Mỗi user trực tuyến có 1 instance DO.
    *   Quản lý: Trạng thái Online/Offline, duy trì heartbeat, thời gian tương tác cuối (last seen) và thông báo trực tiếp cho bạn bè.

---

## 2. Quy Tắc Tầng Dữ Liệu (Database & Storage Rules)

### 2.1. Quy Tắc Dữ Liệu Quan Hệ (D1 - SQLite)
*   **Khóa chính**: Tất cả các bảng dữ liệu phải sử dụng kiểu dữ liệu `TEXT` chứa chuỗi UUID (v4 hoặc v7) hoặc ULID để định danh. Không sử dụng kiểu số nguyên tự tăng (`AUTOINCREMENT`) cho các khóa chính của bảng phân tán nhằm tránh xung đột dữ liệu biên.
*   **Tên cột**: Đặt theo chuẩn `snake_case` (ví dụ: `sender_id`, `created_at`).
*   **Chỉ mục (Index)**: Phải tạo chỉ mục rõ ràng cho các khóa ngoại và các trường thường xuyên truy vấn bộ lọc (ví dụ: `conversation_id`, `user_id_1`, `user_id_2`).

### 2.2. Chiến Lược Phân Trang Lịch Sử Chat
*   **Bắt buộc sử dụng Cursor Pagination**: Không sử dụng `OFFSET` vì hiệu năng sẽ giảm dần khi dữ liệu lớn.
*   **Cú pháp chuẩn**:
    ```sql
    SELECT * FROM Messages 
    WHERE conversation_id = ? AND created_at < ? 
    ORDER BY created_at DESC 
    LIMIT 50
    ```
*   Cursor được truyền lên là timestamp `created_at` dạng Epoch Milliseconds.

### 2.3. Quy Tắc Lưu Trữ File (R2 Storage)
*   **Không truyền file nhị phân qua WebSocket/Worker**: Client bắt buộc phải upload trực tiếp lên Cloudflare R2 thông qua **Presigned URL** (PUT).
*   **Bảo mật file**: Mọi tệp tải lên mặc định có trạng thái quét virus là `PENDING`. Chỉ khi Consumer Worker quét virus và cập nhật trạng thái là `CLEAN` trong bảng `Attachments`, người dùng mới có thể tải xuống thông qua Presigned URL (GET).

---

## 3. Quy Tắc Kiểm Soát Tần Suất & Bảo Mật (Rate Limiting & Security)

### 3.1. Các Hạn Mức Tần Suất (Rate Limits)
Tất cả các API nhạy cảm phải được bảo vệ bởi bộ giới hạn tần suất bằng Cloudflare KV (Sliding Window) hoặc Cloudflare Rate Limiting:
1.  **Auth (Đăng nhập)**: Tối đa 5 lần / 1 phút / 1 IP.
2.  **OTP (Mã xác minh)**: Tối đa 3 lần / 15 phút / 1 Email.
3.  **Message (Gửi tin nhắn)**: Tối đa 100 tin nhắn / 1 phút / 1 User.
4.  **Upload (Tải file lên)**: Tối đa 20 file / 1 giờ / 1 User.

### 3.2. Xác Thực & Phân Quyền (Authentication)
*   JWT Token được truyền qua HTTP Header `Authorization: Bearer <TOKEN>`.
*   Mỗi khi Client kết nối WebSocket vào `ConversationDO`, Worker Gatekeeper phải kiểm tra JWT Token để xác thực danh tính người dùng và kiểm tra xem người dùng đó có nằm trong danh sách thành viên của cuộc hội thoại (`ConversationMembers`) trước khi cho phép thiết lập kết nối.

---

## 4. Nguyên Tắc Phát Triển Giao Diện (Frontend)

*   **Responsive First**: Tất cả các màn hình phải được thiết kế dạng responsive, đảm bảo trải nghiệm hoàn hảo trên màn hình mobile dọc và desktop ngang.
*   **State-driven UI**: Không thực hiện các thao tác DOM thủ công (no direct DOM manipulation). Trạng thái của khung chat, danh sách tin nhắn và danh sách online phải được quản lý chặt chẽ qua state (React State / Context).
*   **Premium Glassmorphism**: Kế thừa và phát triển phong cách kính mờ cao cấp của VivyChat. Sử dụng các thẻ CSS `backdrop-filter: blur()`, viền mỏng semi-transparent và hiệu ứng ambient glow để mang lại trải nghiệm tốt nhất.
