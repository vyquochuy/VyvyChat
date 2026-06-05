# Nhật Ký Phát Triển - Phase 2: Hệ Thống Bạn Bè & Tìm Kiếm (Log/phase_2_friend_system.md)

*   **Trạng thái**: Đã hoàn thành (Completed)
*   **Thời gian thực hiện**: 2026-06-05
*   **Người thực hiện**: AI Architect & Lead Developer

---

## 1. Công Việc Đã Hoàn Thành (What's Done)

1.  **Cơ sở dữ liệu (D1)**:
    *   Tạo và áp dụng file migration `0003_create_friends_and_notifications_tables.sql` thành công dưới local.
    *   Bảng `friendships` và `notifications` được cấu hình ràng buộc khóa ngoại chặt chẽ và đánh chỉ mục để tăng tốc truy vấn.
2.  **Xác thực API (Hono Backend)**:
    *   Xây dựng middleware `authMiddleware` xác thực mã JWT an toàn sử dụng Web Crypto API của Hono, kiểm tra tính hợp lệ và thời hạn token, sau đó gán thông tin user vào Context Variables.
3.  **API Endpoints**:
    *   `GET /api/users/search`: Tìm kiếm người dùng linh hoạt bằng UID (chính xác), Email (chính xác) hoặc Tên hiển thị (tìm kiếm gần đúng bằng `LIKE`), tự động trả về trạng thái quan hệ tương đối (`NONE`, `PENDING_SENT`, `PENDING_RECEIVED`, `ACCEPTED`).
    *   `POST /api/friends/request`: Gửi yêu cầu kết bạn, tự động gửi thông báo hệ thống và tự động chấp nhận nếu đối phương đã gửi lời mời trước đó.
    *   `GET /api/friends`: Lấy danh sách bạn bè đã kết nối (`ACCEPTED`).
    *   `GET /api/friends/requests`: Lấy danh sách lời mời kết bạn đang chờ duyệt.
    *   `POST /api/friends/respond`: Phản hồi lời mời (chấp nhận hoặc từ chối).
    *   `GET /api/notifications`: Lấy danh sách thông báo của người dùng.
    *   `POST /api/notifications/:id/read`: Đánh dấu thông báo đã đọc.
4.  **Giao diện người dùng (React Frontend)**:
    *   Nâng cấp trang `success` sau khi đăng nhập thành một Dashboard phân tab hoàn chỉnh theo chuẩn thiết kế Kính mờ (Glassmorphism).
    *   Xây dựng Tab Trang chủ (Thông báo), Tab Danh bạ (quản lý Bạn bè và lời mời chờ duyệt), và Tab Tìm kiếm (tìm kiếm và tương tác kết bạn thời gian thực).
    *   Thiết lập cơ chế tự động thăm dò (polling) 8 giây để cập nhật tức thì dữ liệu thông báo và lời mời mới.

---

## 2. Kết Quả Kiểm Thử (Verification Results)

*   **TypeScript Check**: Biên dịch thành công 100% không cảnh báo lỗi ở cả backend và frontend (`npx tsc --noEmit`).
*   **Database Schema**: Khởi chạy migration cục bộ thành công 100%, cấu trúc bảng khớp thiết kế.
*   **Kiểm thử chức năng**: 
    - Đăng ký 2 tài khoản, đăng nhập và tìm kiếm tài khoản kia qua UID hoạt động chính xác.
    - Gửi lời mời kết bạn hoạt động, đối phương nhận được thông báo yêu cầu kết bạn ngay trên Dashboard.
    - Chấp nhận kết bạn hoạt động, danh sách bạn bè ở cả hai bên lập tức được cập nhật trạng thái "Bạn bè".

---

## 3. Kế Hoạch Tiếp Theo (Next Steps)

*   **Bắt đầu Phase 3: Basic Chat Interface**
    *   Xây dựng giao diện khung chat nền tảng web chia cột (Sidebar, MessageList, MessageInput).
    *   Tích hợp State Management để chuẩn bị cho luồng WebSocket của Phase 4.
