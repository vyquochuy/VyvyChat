# Nhật Ký Thay Đổi (Log/changeLog.md)

Tài liệu này lưu trữ lịch sử thay đổi tổng quát của dự án **VivyChat** qua các giai đoạn phát triển.

## [2026-06-13] - Hệ thống Avatar Vector Chibi & Tối ưu Giao diện Chat (Phase 8)

### Thêm mới (Added)
*   Triển khai bộ sinh ảnh đại diện bằng đồ họa vector SVG (`circle`, `ellipse`, `path`, `polygon`, `rect`) động phía máy khách trong `avatar.ts`.
*   Tích hợp 6 hình mẫu chibi mascot đa dạng: Mèo, Gấu (gồm Panda), Thỏ gặm cà rốt, Cáo đuôi trắng, Slime vương miện và Anime Girl mắt to.
*   Cài đặt bộ băm chuỗi UID (`hashString`) và giải thuật số ngẫu nhiên hạt giống tuyến tính đồng dư LCG (`SeededRandom`) để đảm bảo avatar hiển thị nhất quán trên mọi thiết bị.
*   Triển khai bộ đệm Map runtime cache lưu trữ data-URI của SVG để tối ưu hóa hiệu năng render.
*   Thiết kế dải phân cách ngày thân thiện dạng lịch (Hôm nay, Hôm qua, Thứ Hai - Chủ Nhật) tự động chuyển tiếp giữa các ngày.
*   Tạo màn hình chờ Shimmer xương (Skeleton Loader) của cả Avatar và Bong bóng tin nhắn song song mô phỏng theo Discord.
*   Bổ sung phím tắt: gõ `Enter` để gửi tin nhắn nhanh và `Shift + Enter` để tạo dòng mới trong ô chat.

### Thay đổi (Changed)
*   Mở rộng tỷ lệ hiển thị khung chat trên desktop lên mức rộng tối đa `1440px`, `95vw` và chiều cao `85vh` có giới hạn tỷ lệ.
*   Tự động tối ưu hóa hiển thị tràn toàn màn hình (`100dvh`) trên giao diện di động.
*   Ẩn thanh header và footer trang chủ khi đã đăng nhập thành công. Di chuyển profile người dùng và nút đăng xuất xuống Discord-style footer của Sidebar.
*   Redesign nút gửi tin nhắn thành hình tròn chứa icon máy bay giấy nhỏ gọn. Chuyển đổi khung nhập liệu sang Textarea tự động co giãn chiều cao (max 120px).
*   Gom nhóm các tin nhắn liên tiếp gửi trong vòng 10 phút, tự động duỗi thẳng các góc cạnh của bong bóng phía người gửi để tạo hiệu ứng xếp chồng.
*   Tự động ngắt khối tin nhắn khi có tệp đính kèm hoặc tin nhắn hệ thống, và che giấu mã khóa E2EE thô trên Toast thông báo thành `🔒 Tin nhắn mã hóa`.

---

## [2026-06-05] - Giao diện Chat cơ bản & Quản lý trạng thái Client (Phase 3)

### Thêm mới (Added)
*   Cài đặt thư viện `zustand` quản lý trạng thái client gọn nhẹ, hiệu năng cao.
*   Khởi tạo `chatStore.ts` để lưu trữ và quản lý tập trung danh sách bạn bè, người bạn đang chọn và các cuộc hội thoại thử nghiệm.
*   Tạo thư mục components chat chuyên dụng (`Sidebar.tsx`, `ChatArea.tsx`, `MessageList.tsx`, `MessageInput.tsx`) theo chuẩn thiết kế Kính mờ (Glassmorphism).
*   Thực hiện thuật toán tự động cuộn xuống tin nhắn mới nhất (auto-scroll) và cơ chế dọn dẹp bộ nhớ đệm an toàn khi đăng xuất (store cleanup on logout).
*   Ghi nhận tài liệu kỹ thuật tổng kết Phase 3 trong `docs/phase-records/` và nhật ký phát triển trong `Log/`.

### Thay đổi (Changed)
*   Nâng cấp trang `success` của `App.tsx` thành giao diện dashboard 2 cột responsive (Mobile ẩn hiện cột linh hoạt, Desktop hiển thị song song).
*   Tăng chiều rộng tối đa của container thành `960px` khi hiển thị dashboard để phù hợp với không gian chat chuyên nghiệp.

---

## [2026-06-05] - Hệ thống Bạn bè & Tìm kiếm (Phase 2)

### Thêm mới (Added)
*   Khởi tạo bảng cơ sở dữ liệu `friendships` và `notifications` trên Cloudflare D1 local qua file migration.
*   Thiết lập Hono JWT `authMiddleware` xác thực API an toàn bằng Web Crypto API và thuật toán `HS256`.
*   Tích hợp các endpoints mới bảo mật cho backend: Tìm kiếm người dùng (`/api/users/search`), gửi/nhận lời mời kết bạn (`/api/friends/request`, `/api/friends/respond`), danh sách bạn bè (`/api/friends`), danh sách chờ (`/api/friends/requests`), danh sách thông báo và đánh dấu đã đọc (`/api/notifications`).
*   Nâng cấp trang `success` của Frontend thành một Giao diện Dashboard Glassmorphism phân tab hoàn chỉnh (Trang chủ/Thông báo, Danh bạ bạn bè/yêu cầu chờ duyệt, và Tìm kiếm người dùng thời gian thực).
*   Tạo file tài liệu ghi nhận kỹ thuật và tiến độ cho Phase 2.

### Thay đổi (Changed)
*   Thay thế UID ngẫu nhiên thành UID tăng dần tuần tự từ `10000000` đến `99999999` thông qua subquery trực tiếp khi chèn hàng mới vào SQLite D1, bảo mật email và tăng tốc độ tìm kiếm.

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
