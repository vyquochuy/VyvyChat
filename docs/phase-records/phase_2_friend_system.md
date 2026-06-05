# Tài Liệu Kỹ Thuật Phase 2: Hệ Thống Bạn Bè & Tìm Kiếm

Tài liệu này tổng hợp các công nghệ, thuật toán, thư viện, lý thuyết và bài học kinh nghiệm được tích lũy sau khi hoàn thành Phase 2 của dự án **VivyChat** (Hệ thống Bạn bè & Tìm kiếm).

---

## 1. Công Nghệ & Framework (Technologies & Frameworks)

*   **Cloudflare D1 (SQLite)**: Lưu trữ các thực thể quan hệ nâng cao:
    *   Bảng `friendships` để biểu diễn quan hệ giữa 2 người dùng.
    *   Bảng `notifications` để lưu trữ các thông báo gửi đến người dùng.
*   **Hono Middleware**: Sử dụng cơ chế Middleware của Hono để tạo ra bộ lọc xác thực JWT (`authMiddleware`) nhằm bảo vệ các tài nguyên API riêng tư, trích xuất dữ liệu người dùng từ JWT và gán vào Context Variables (`c.set('user', ...)`).
*   **React Dynamic Dashboard**: Xây dựng UI dashboard với cơ chế phân chia Tab (Trang chủ, Danh bạ, Tìm kiếm) sử dụng phong cách thiết kế kính mờ cao cấp (Premium Glassmorphism). Tích hợp cơ chế tự động làm mới (polling/auto-refresh) mỗi 8 giây để cập nhật tức thì lời mời kết bạn và thông báo mới.

---

## 2. Thuật Toán & Lý Thuyết (Algorithms & Theories)

*   **Cơ chế lưu trữ quan hệ Bạn bè (Unordered Pair representation in Database)**:
    *   Để lưu trữ mối quan hệ 1-1 giữa 2 người dùng mà không bị trùng lặp, chúng ta áp dụng ràng buộc `UNIQUE(user_id_1, user_id_2)`.
    *   Khi thực hiện gửi lời mời kết bạn, API sẽ kiểm tra xem bản ghi đã tồn tại ở một trong hai chiều chưa:
        ```sql
        SELECT * FROM friendships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)
        ```
    *   Nếu chưa tồn tại, lời mời được ghi nhận ở dạng `PENDING`. Nếu đã tồn tại dưới dạng `PENDING` nhưng do đối phương gửi trước đó, hệ thống sẽ tự động chuyển thành `ACCEPTED` (tính năng Auto-Accept tiện lợi).
*   **Cơ chế Tìm kiếm Đa hướng (Multi-field Lookup)**:
    *   Để bảo mật email người dùng, hệ thống phân tích chuỗi tìm kiếm đầu vào:
        - Nếu chuỗi tìm kiếm chỉ gồm chữ số (`/^\d+$/`), hệ thống thực hiện tìm kiếm chính xác theo `uid` (SQLite `INTEGER` index).
        - Nếu chuỗi tìm kiếm chứa ký tự `@`, hệ thống tìm kiếm chính xác theo `email` (SQLite `TEXT` index).
        - Ngược lại, hệ thống tìm kiếm gần đúng theo `display_name` sử dụng toán tử `LIKE %query%` giới hạn tối đa 20 kết quả để tối ưu hiệu năng.
*   **Thiết kế Trạng thái Mối quan hệ tương đối (Relative Relationship Status)**:
    *   Khi trả về kết quả tìm kiếm, API tự động tính toán trạng thái quan hệ của từng người dùng được tìm thấy đối với người dùng hiện tại:
        - `NONE`: Chưa có mối quan hệ (hiển thị nút "Kết bạn").
        - `PENDING_SENT`: Người dùng hiện tại đã gửi lời mời kết bạn (nút "Đã gửi" disabled).
        - `PENDING_RECEIVED`: Đối phương đã gửi lời mời kết bạn cho người dùng hiện tại (hiển thị nút "Chấp nhận").
        - `ACCEPTED`: Đã là bạn bè (nhãn "Bạn bè").
        - `BLOCKED`: Đã chặn.
    *   Cách tiếp cận này giúp Frontend kết xuất giao diện một cách cực kỳ đơn giản và đồng bộ.

---

## 3. Thư Viện & Công Cụ (Libraries & Tools)

*   **`hono/jwt` (verify)**: Thư viện chuẩn mã hóa JWT của Hono được tích hợp sâu để xác thực mã token.
*   **SQLite Indexes (Native)**: Tạo các chỉ mục `idx_friendships_user_1`, `idx_friendships_user_2` và `idx_notifications_user` để tối ưu hóa hiệu năng câu lệnh JOIN/SELECT của D1 Database.

---

## 4. Kiến Thức Đúc Kết (Key Takeaways & Lessons Learned)

*   **Bắt buộc xác định Thuật toán mã hóa rõ ràng trong Hono JWT (v4+)**:
    *   Kể từ các phiên bản cập nhật bảo mật của Hono, hàm `verify()` yêu cầu truyền rõ thuật toán mã hóa (ví dụ `'HS256'`) làm đối số thứ 3 thay vì tự động đoán hoặc sử dụng giá trị mặc định để tránh các lỗ hổng bảo mật liên quan đến bypass thuật toán (Algorithm Confusion Attacks).
*   **SQLite và Ràng buộc Foreign Key**:
    *   Việc sử dụng khóa ngoại `FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE` giúp cơ sở dữ liệu tự động dọn dẹp các lời mời kết bạn và thông báo liên quan khi một tài khoản người dùng bị xóa, đảm bảo tính toàn vẹn dữ liệu ở mức tối đa mà không cần viết thêm code dọn dẹp ở tầng ứng dụng.
*   **Giải pháp phân phối Trạng thái tương đối (Relationship Resolution)**:
    *   Việc giải quyết trạng thái quan hệ ngay từ Backend giúp Frontend tránh được việc phải tải toàn bộ danh sách bạn bè/yêu cầu kết bạn về máy rồi chạy các vòng lặp Client-side phức tạp để so khớp trạng thái, giúp ứng dụng nhẹ hơn và phản hồi mượt mà hơn.
