# Báo cáo Kết quả Thực hiện Lựa chọn Tin nhắn, Ghim & Chuyển tiếp - Phase 9

Báo cáo này tổng hợp kết quả của quá trình nâng cấp trải nghiệm người dùng trong hệ thống trò chuyện của **VivyChat** thông qua việc triển khai các lựa chọn nâng cao cho tin nhắn: **Thu hồi (Recall)**, **Ghim (Pin)**, và **Chuyển tiếp (Forward)** bảo mật kết hợp giải mã/tái mã hóa E2EE client-side.

---

## 🚀 Các công việc đã hoàn thành (Achievements)

### 1. Nút Lựa chọn Ba chấm & Menu ngữ cảnh thông minh (Context Menu)
- **Thiết kế Responsive**: Thay thế nút thùng rác thô sơ bằng nút ba chấm dọc (`...`) hoạt động mượt mà trên cả máy tính (hiển thị khi hover) và thiết bị di động (hiển thị cố định với độ mờ `opacity-70` để hỗ trợ thao tác chạm).
- **Phân tách quyền sở hữu**:
  - Đối với tin nhắn của bản thân (`isMe`): hiển thị **Thu hồi**, **Ghim**, và **Chuyển tiếp**.
  - Đối với tin nhắn của người khác (`!isMe`): hiển thị **Ghim** và **Chuyển tiếp**.
- **Định vị chống tràn biên màn hình (Boundary Protection)**:
  - Tự động căn chỉnh phía trong màn hình (`left-0` đối với tin nhắn gửi đi và `right-0` đối với tin nhắn nhận được) để ngăn không cho menu bị khuất ở biên trái/phải.
  - Sử dụng định vị hướng lên (`bottom-8`) để ngăn không cho menu bị che khuất bởi thanh nhập tin nhắn ở cuối màn hình.
  - Tích hợp lắng nghe sự kiện nhấn chuột bên ngoài (click-outside listener) để đóng menu thông minh.

### 2. Chức năng Ghim Tin nhắn (Message Pinning)
- **Lưu trữ trạng thái**: Quản lý thông tin tin nhắn được ghim theo từng phòng trò chuyện (`pinnedMessages` ánh xạ theo `friendId`).
- **Thanh thông báo ghim chuyên nghiệp**: Hiển thị thanh Pinned Message Bar dạng kính mờ (glassmorphism) ngay dưới thanh tiêu đề phòng chat với biểu tượng ghim nhảy động (animate-bounce).
- **Tính năng cuộn thông minh**:
  - Nhấp vào thanh ghim sẽ tự động tìm phần tử DOM thông qua thuộc tính định danh duy nhất `id={`msg-${msg.id}`}` đã thêm vào mỗi tin nhắn và cuộn mượt mà (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) tới tin nhắn gốc.
  - Nút bỏ ghim `(X)` trên thanh tiêu đề cho phép gỡ ghim tức thời.

### 3. Chức năng Chuyển tiếp Tin nhắn (Message Forwarding)
- **Đồng bộ hóa E2EE và Tệp đính kèm**:
  - Đối với tin nhắn chứa văn bản thông thường: được chuyển tiếp ngay lập tức.
  - Đối với tin nhắn chứa tệp đính kèm: hệ thống sẽ thực hiện tải tệp đã mã hóa từ Cloudflare R2, giải mã trực tiếp trong bộ nhớ đệm máy khách bằng thuật toán AES-GCM và khóa chia sẻ hiện tại trong lúc hiển thị vòng xoay chờ (loading spinner).
  - Tự động mã hóa tệp đính kèm bằng khóa chia sẻ mới của phòng chat đích trước khi tải lên và gửi qua WebSocket. Đối với các phòng chat không bật E2EE, tệp đính kèm sẽ được gửi dưới dạng bảo mật thông thường sạch sẽ.
- **Hộp thoại tìm kiếm bạn bè**: Thiết kế overlay modal tuyệt đẹp hỗ trợ bộ lọc tìm kiếm bạn bè nhanh chóng, cho phép người dùng bấm "Gửi" để chuyển đổi phòng chat và chuyển tiếp tin nhắn lập tức.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **React & Zustand**: Đồng bộ trạng thái chuyển tiếp (`pendingForwardMessage`) và trạng thái ghim tin nhắn (`pinnedMessages`) hiệu quả.
- **Web Crypto API**: Thực hiện giải mã tệp đính kèm từ phòng chat nguồn và tái mã hóa bằng khóa bảo mật của phòng chat đích trước khi gửi.
- **CSS Variables & Tailwind**: Tối ưu màu sắc hiển thị hài hòa theo giao diện sáng/tối (light/dark mode) chuẩn premium.

---

## 💡 Kiến thức đúc kết (Lessons Learned)

1. **Khắc phục lỗi kích thước trong Flexbox**: Việc sử dụng thuộc tính `w-fit` phối hợp với việc đặt giới hạn `max-w-[60%]` trực tiếp lên khối chứa nội dung (thay vì thẻ cha flex) giúp giải quyết triệt để lỗi ép nhỏ chữ hoặc đè nút lựa chọn lên nội dung tin nhắn, giúp văn bản tự động giãn nở tự nhiên và ngắt dòng đúng chuẩn.
2. **Quy trình tái mã hóa an toàn**: Khi chuyển tiếp tệp đính kèm trong môi trường E2EE, việc tải xuống và giải mã tệp tin ở client rồi mới thực hiện mã hóa lại là giải pháp duy nhất khả thi để đảm bảo máy chủ không thể đọc được nội dung tệp mà vẫn đảm bảo tính an toàn dữ liệu đầu cuối.
