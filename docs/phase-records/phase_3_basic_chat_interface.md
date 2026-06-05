# Tài Liệu Kỹ Thuật Phase 3: Giao Diện Chat Cơ Bản (Basic Chat Interface)

Tài liệu này tổng hợp các công nghệ, thuật toán, thư viện, lý thuyết và bài học kinh nghiệm được tích lũy sau khi hoàn thành Phase 3 của dự án **VivyChat** (Xây dựng Giao diện Chat cơ bản và Quản lý trạng thái Client).

---

## 1. Công Nghệ & Framework (Technologies & Frameworks)

*   **React (TypeScript)**: Xây dựng các components chat có tính phản hồi cao, an toàn kiểu dữ liệu (type-safe) và tuân thủ các quy tắc của React 18.
*   **Zustand (State Management)**: Sử dụng làm công cụ quản lý trạng thái tập trung gọn nhẹ trên Client thay thế cho React Context API, giúp tránh render thừa thãi (unnecessary re-renders) và dễ dàng mở rộng cho kết nối WebSocket ở Phase 4.
*   **TailwindCSS & Vanilla CSS**: Sự kết hợp hoàn hảo để tạo nên giao diện chuẩn **Premium Glassmorphism**:
    *   Sử dụng CSS Variables để thiết kế hệ màu sắc tối huyền ảo (harmonious dark mode palette) với các tông màu Neon Cyan và Neon Purple phản quang.
    *   Tận dụng thuộc tính `backdrop-filter: blur(18px)` kết hợp với viền nửa trong suốt (`rgba(255, 255, 255, 0.08)`) mang lại trải nghiệm chiều sâu cao cấp.

---

## 2. Thuật Toán & Lý Thuyết (Algorithms & Theories)

*   **Mô Hỏi Trạng Thái Tách Biệt (Decoupled Client-side State Machine)**:
    *   Tách biệt hoàn toàn phần lưu trữ dữ liệu (tin nhắn, danh sách bạn bè) ra khỏi vòng đời của React Components bằng cách đưa vào Zustand Store (`useChatStore`).
    *   Giúp giữ lại lịch sử chat cục bộ khi người dùng di chuyển giữa các tab khác nhau trong Sidebar mà không bị reset dữ liệu.
*   **Thuật Toán Tự Động Cuộn Xuống Dưới (Smart Auto-Scroll to Bottom)**:
    *   Sử dụng `useRef` trỏ vào thẻ cuối cùng của MessageList kết hợp với `useEffect` lắng nghe sự thay đổi của danh sách tin nhắn hoặc cuộc trò chuyện hoạt động (`activeFriendId`).
    *   Khi có tin nhắn mới hoặc đổi phòng chat, trình duyệt tự động gọi hàm `.scrollIntoView({ behavior: 'smooth' })` để đưa trải nghiệm người dùng luôn tập trung vào tin nhắn mới nhất.
*   **Nguyên Tắc Thiết Kế Responsive Hai Cột Trên Mobile & Desktop**:
    *   Thiết kế chia cột linh hoạt bằng cách sử dụng các CSS utility classes của Tailwind (`hidden md:block` và `block md:hidden`).
    *   **Trên Desktop (màn hình lớn hơn 768px):** Cột trái (Sidebar) và cột phải (ChatArea) hiển thị song song cạnh nhau.
    *   **Trên Mobile (màn hình nhỏ hơn 768px):**
        - Nếu chưa chọn cuộc hội thoại (`activeFriendId === null`), cột trái (Sidebar) hiển thị toàn màn hình, cột phải (ChatArea) bị ẩn.
        - Nếu đã chọn cuộc hội thoại, cột phải (ChatArea) hiển thị toàn màn hình với nút "Quay lại" (Back) để hủy chọn `activeFriendId` và hiển thị lại Sidebar.

---

## 3. Thư Viện & Công Cụ (Libraries & Tools)

*   **`zustand` (v4+)**: Thư viện quản lý trạng thái cực kỳ nhẹ (chỉ khoảng 1.5KB) dựa trên mô hình hooks đơn giản, không cần boilerplate phức tạp như Redux.
*   **Vite Dev Server**: Dùng để chạy thử nghiệm giao diện cực nhanh với tính năng HMR (Hot Module Replacement) giữ nguyên trạng thái Store khi sửa code.

---

## 4. Kiến Trúc Lưu Trữ Tin Nhắn Tạm Thời (Temporary Client-side Messages Mocking)

*   Do kết nối WebSocket trực tuyến và việc ghi nhận database lịch sử chat thực tế sẽ được triển khai tại Phase 4, ở Phase 3 chúng ta áp dụng cơ chế tin nhắn mẫu ban đầu (`getMockInitialMessages`) cho mỗi phòng chat để giao diện không bị trống trải.
*   Khi người dùng gửi tin nhắn qua ô nhập liệu, hàm `addMessage` trong Store sẽ chèn thêm tin nhắn đó vào mảng tương ứng của friendId trong RAM, giúp kiểm thử luồng UX gửi tin mượt mà lập tức mà không cần kết nối mạng.

---

## 5. Kiến Thức Đúc Kết (Key Takeaways & Lessons Learned)

*   **Kiểm Soát Rò Rỉ Trạng Thái Khi Đăng Xuất (Store Resetting on Logout)**:
    *   Khi người dùng nhấn Đăng xuất, toàn bộ trạng thái trong Zustand store (bao gồm danh sách bạn bè và tin nhắn nhạy cảm) phải được dọn dẹp sạch sẽ bằng hàm `clearStore()`. Điều này cực kỳ quan trọng để đảm bảo tính bảo mật và ngăn tài khoản đăng nhập sau nhìn thấy tin nhắn của tài khoản trước.
*   **Tránh Lỗi Unused Locals trong TypeScript**:
    *   Khi cấu hình TypeScript nghiêm ngặt (`noUnusedLocals: true`), việc khai báo các biến không sử dụng từ destructuring (ví dụ `setActiveFriendId` trong `App.tsx`) sẽ lập tức khiến hệ thống từ chối biên dịch. Hãy luôn kiểm tra kỹ các biến được import/destructure và dọn dẹp các biến dư thừa.
