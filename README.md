# VivyChat - Serverless E2EE Realtime Messaging Platform

VivyChat là một nền tảng nhắn tin thời gian thực 1-1 bảo mật, hoạt động trên kiến trúc Serverless (Edge Computing) của Cloudflare Workers kết hợp mã hóa đầu cuối (End-to-End Encryption - E2EE) mặc định ở phía Client.

Dự án đảm bảo tính riêng tư tuyệt đối (Zero-Knowledge) nhờ việc tự thỏa thuận và mã hóa khóa trực tiếp trên trình duyệt của người dùng, cô lập hoàn toàn không gian lưu trữ khóa của các tài khoản khác nhau trên cùng một thiết bị.

---

## Project Description

Hệ thống của VivyChat được phát triển và vận hành dựa trên sự kết hợp giữa kiến trúc biên đám mây (Edge Computing) và các tiêu chuẩn bảo mật mật mã học hiện đại.

### Các tính năng cốt lõi:
- **Xác thực OTP Email bảo mật:** Quy trình đăng ký và khôi phục mật khẩu thông qua mã OTP 6 chữ số gửi qua email (sử dụng Google Apps Script làm webhook gửi mail), đi kèm cơ chế Rate Limiting chống spam và khóa tài khoản khi nhập sai OTP quá 5 lần.
- **Mã hóa đầu cuối (E2EE) mặc định:** Sử dụng thuật toán trao đổi khóa ECDH P-256 để thỏa thuận Shared Secret và mã hóa tin nhắn bằng AES-256-GCM trực tiếp ở client. Máy chủ trung gian chỉ chuyển tiếp ciphertext và không có khả năng đọc thô tin nhắn.
- **Cô lập khóa đa tài khoản trên cùng thiết bị:** Khóa E2EE được lưu dưới dạng đối tượng gộp không thể trích xuất (`extractable: false`) trong IndexedDB có cấu trúc `e2ee:${userId}`, ngăn ngừa rò rỉ hoặc ghi đè khóa chéo giữa các phiên đăng nhập khác nhau trên cùng trình duyệt.
- **Đồng bộ và xoay vòng khóa (Key Rotation):** Hỗ trợ sao lưu khóa bí mật lên server thông qua mã hóa PBKDF2 (260.000 vòng) bảo vệ bằng Recovery Password. Hỗ trợ xoay vòng khóa để đảm bảo tính an toàn dài hạn (Forward Secrecy).
- **Trò chuyện thời gian thực độ trễ thấp:** Kết nối WebSocket thông qua Cloudflare Durable Objects giúp đồng bộ tin nhắn tức thời, cập nhật trạng thái hoạt động (online/offline) và hiển thị chỉ báo đang gõ phím (Typing Indicator).

---

## Table of Contents
1. [Project Description](#project-description)
2. [How to Install and Run the Project](#how-to-install-and-run-the-project)
3. [How to Use the Project](#how-to-use-the-project)
4. [Include Tests](#include-tests)
5. [How to Contribute to the Project](#how-to-contribute-to-the-project)
6. [Include Credits](#include-credits)
7. [Add a License](#add-a-license)

---

## How to Install and Run the Project

Dự án được tổ chức dưới dạng monorepo chứa cả mã nguồn Frontend và Backend Cloudflare Workers.

### Yêu cầu hệ thống:
- [Node.js](https://nodejs.org/) v18 trở lên.
- [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) cài đặt toàn cục hoặc chạy qua `npx`.

### 1. Cài đặt dependencies
Tại thư mục gốc của dự án, chạy lệnh sau để cài đặt toàn bộ dependencies cho cả frontend và backend:
```bash
npm run install:all
```

### 2. Thiết lập cơ sở dữ liệu D1 nội bộ (Local DB)
Di chuyển vào thư mục backend và chạy migrations để khởi tạo cấu trúc cơ sở dữ liệu SQLite cục bộ:
```bash
cd backend-cloudflare
npx wrangler d1 migrations apply vivychat-db --local
```

### 3. Chạy Backend (Local Dev)
Chạy server backend cục bộ mô phỏng Cloudflare Workers & Durable Objects tại cổng `8787`:
```bash
# Tại thư mục backend-cloudflare hoặc chạy lệnh ở gốc monorepo:
npm run dev
```

### 4. Chạy Frontend (Vite Dev Server)
Mở một terminal mới, chuyển vào thư mục frontend và chạy Vite development server tại cổng `5173`:
```bash
# Tại thư mục frontend hoặc chạy lệnh ở gốc monorepo:
npm run dev
```

---

## How to Use the Project

### 1. Đăng ký & Kích hoạt tài khoản
- Truy cập giao diện tại `http://localhost:5173`.
- Điền email nhận mã OTP. Sau khi mã OTP được gửi về hòm thư, điền mã OTP và thông tin tài khoản để hoàn thành đăng ký.

### 2. Thiết lập mã hóa đầu cuối (E2EE)
- Sau khi đăng nhập, di chuyển sang tab Bảo mật (biểu tượng 🔒) trên thanh Sidebar.
- Nhập mật khẩu khôi phục khóa (Recovery Password - tối thiểu 8 ký tự). Nhấp **Setup Encryption** để sinh cặp khóa mật mã. Khóa công khai của bạn sẽ được tải lên server, còn khóa bí mật sẽ được lưu an toàn trong IndexedDB của trình duyệt.

### 3. Kết bạn và Nhắn tin bảo mật
- Di chuyển sang tab **Tìm** để tìm kiếm bạn bè thông qua UID hoặc email.
- Nhấp **Kết bạn**. Sau khi đối phương chấp nhận lời mời, hai người có thể nhấp vào tên nhau để bắt đầu cuộc trò chuyện.
- Trình duyệt sẽ tự động thực hiện tính toán Shared Secret với khóa công khai của đối phương và mã hóa tất cả tin nhắn gửi đi dưới dạng AES-GCM. Bạn sẽ thấy chỉ báo đang gõ phím (Typing Indicator) và nhận thông báo Toast thời gian thực khi có tin nhắn mới từ người khác.

---

## Include Tests

Dự án sử dụng TypeScript nghiêm ngặt và Vite để kiểm thử tính khả thi của mã nguồn.

### 1. Kiểm tra biên dịch TypeScript
Kiểm tra tĩnh xem mã nguồn có lỗi kiểu dữ liệu nào không bằng cách chạy:
```bash
# Kiểm tra frontend
npm run build --prefix frontend

# Kiểm tra backend
npx wrangler dev --prefix backend-cloudflare
```

### 2. Kiểm thử thủ công luồng E2EE đa thiết bị
- **Bước 1:** Đăng nhập Tài khoản A trên Trình duyệt 1 (ví dụ Chrome), thiết lập E2EE thành công và gửi tin nhắn.
- **Bước 2:** Đăng nhập Tài khoản B trên Trình duyệt 2 (ví dụ Firefox), thiết lập E2EE và phản hồi tin nhắn.
- **Bước 3:** Đăng xuất và đăng nhập tài khoản khác trên cùng trình duyệt để xác minh khóa cũ không bị lấy nhầm hay đọc trộm (Multi-account isolation).

---

## How to Contribute to the Project

Mọi đóng góp cho dự án đều được chào đón. Quy trình đóng góp diễn ra như sau:

1. **Fork** dự án này về tài khoản cá nhân của bạn.
2. Tạo một nhánh mới từ `master` để thực hiện sửa đổi:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Commit các thay đổi của bạn với thông điệp rõ ràng theo chuẩn Conventional Commits (ví dụ: `feat(ui): add new encryption status indicators`).
4. Kiểm tra biên dịch thành công (`npm run build`) trước khi đẩy code.
5. Thực hiện **Push** nhánh lên Fork của bạn và tạo một **Pull Request** giải trình rõ ràng các nội dung chỉnh sửa để được phê duyệt.

---

## Include Credits

Dự án VivyChat chân thành cảm ơn các công nghệ, thư viện nguồn mở và nền tảng dưới đây đã hỗ trợ kiến tạo ứng dụng:

- **W3C Web Crypto API:** Cung cấp các hàm mã hóa phần cứng native bảo mật cao chạy trực tiếp trên trình duyệt.
- **Cloudflare Edge Platform:** Wrangler, Workers, Durable Objects, và D1 Database làm nền tảng serverless mạnh mẽ và tối ưu độ trễ.
- **Hono Framework:** Web framework siêu nhẹ giúp định tuyến API sạch và hiệu quả trên Edge.
- **React & TypeScript:** Nền tảng xây dựng UI động và đảm bảo tính chặt chẽ của mã nguồn.
- **Zustand:** Thư viện quản lý state tối giản nhưng mạnh mẽ cho React.

---

## Add a License

Dự án VivyChat được phân phối và cấp phép dưới **Giấy phép MIT** (MIT License). Xem chi tiết điều khoản sử dụng trong tệp tin `LICENSE` nếu có.
