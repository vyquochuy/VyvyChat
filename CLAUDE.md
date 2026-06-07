# Hướng Dẫn Quy Trình Phát Triển (CLAUDE.md)

Tài liệu này hướng dẫn quy trình chạy dự án, cập nhật cơ sở dữ liệu, triển khai hệ thống, quy ước đặt tên và cách viết mã nguồn trong repository **VivyChat**.

---

## 1. Hướng Dẫn Chạy Dự Án Dưới Local

### 1.1. Chuẩn bị môi trường
*   Node.js phiên bản `>= 18.0.0`
*   NPM hoặc PNPM (khuyên dùng NPM theo cấu trúc monorepo hiện tại)

### 1.2. Khởi tạo dự án
Từ thư mục gốc của repository, chạy lệnh sau để cài đặt dependencies cho toàn bộ monorepo (frontend & backend):
```bash
npm run install:all
```

### 1.3. Khởi động các môi trường chạy thử (Dev Mode)
*   **Chạy toàn bộ dự án đồng thời**:
    *   Sử dụng lệnh khởi động frontend và backend (mở 2 terminal riêng biệt hoặc dùng script hỗ trợ):
        *   Terminal 1 (Backend Workers): `npm run dev:backend`
        *   Terminal 2 (Frontend React): `npm run dev:frontend`
*   **Chạy riêng lẻ từng thư mục**:
    *   **Backend Worker** (`/backend-cloudflare`):
        ```bash
        cd backend-cloudflare
        npm run dev
        ```
    *   **Frontend Vite** (`/frontend`):
        ```bash
        cd frontend
        npm run dev
        ```

---

## 2. Quy Trình Cập Nhật Cơ Sở Dữ Liệu D1 (D1 Migrations)

Cơ sở dữ liệu Cloudflare D1 chạy trên nền SQLite dưới local thông qua Wrangler.

### 2.1. Tạo file migration mới
Khi cần thay đổi cấu trúc bảng hoặc tạo bảng mới, di chuyển vào thư mục `/backend-cloudflare` và tạo migration:
```bash
npx wrangler d1 migrations create vivychat-db <ten_migration_mo_ta>
```
Lệnh này sẽ tự động tạo một file SQL mới trong thư mục `migrations/` của backend. Hãy viết các câu lệnh SQL thay đổi cấu trúc vào file đó.

### 2.2. Áp dụng migration dưới local (Local Dev)
Để chạy các thay đổi database dưới máy cục bộ của bạn:
```bash
npx wrangler d1 migrations apply vivychat-db --local
```

### 2.3. Áp dụng migration lên Cloudflare thực tế (Production)
Để chạy các thay đổi trên môi trường Cloudflare Live:
```bash
npx wrangler d1 migrations apply vivychat-db --remote
```

---

## 3. Quy Quy Trình Triển Khai Hệ Thống (Deployment)

### 3.1. Triển khai Backend (Cloudflare Workers)
Di chuyển vào `/backend-cloudflare` và chạy lệnh deploy:
```bash
npm run deploy
# hoặc
npx wrangler deploy
```

### 3.2. Triển khai Frontend (Cloudflare Pages)
Frontend được cấu hình auto-deploy thông qua Git Integration với Cloudflare Pages. Khi đẩy code lên nhánh `main`, Cloudflare Pages sẽ tự động build và deploy. 
Nếu cần deploy thủ cậung bằng CLI:
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=vivychat-frontend
```

---

## 4. Quy Ước Lập Trình (Coding Conventions)

### 4.1. Quy ước đặt tên (Naming Conventions)
*   **Biến, Hàm & Class (TypeScript/JS)**: Sử dụng `camelCase` cho biến và hàm (ví dụ: `sendMessage`, `isUserOnline`). Sử dụng `PascalCase` cho tên Class, React Component và Interface (ví dụ: `ChatCard`, `UserPresenceDO`).
*   **Cơ sở dữ liệu (D1 / SQLite)**: Tên bảng và tên cột phải sử dụng `snake_case` (ví dụ: `conversation_members`, `sender_id`, `created_at`).
*   **Tên file**:
    *   React Component: `PascalCase.tsx` (ví dụ: `ChatWindow.tsx`).
    *   Hàm trợ giúp / Logic: `camelCase.ts` (ví dụ: `hashHelper.ts`).
    *   File cấu hình: `lowercase` (ví dụ: `wrangler.toml`).

### 4.2. Định dạng Commit (Commit Message Conventions)
Tuân thủ chuẩn **Conventional Commits**:
*   `feat`: Thêm một tính năng mới (ví dụ: `feat: add message reactions table and api`).
*   `fix`: Sửa một lỗi kỹ thuật (ví dụ: `fix: resolve rate limit sliding window reset issue`).
*   `docs`: Cập nhật tài liệu hướng dẫn (ví dụ: `docs: update deployment steps`).
*   `style`: Các thay đổi về style giao diện, format code không ảnh hưởng đến logic.
*   `refactor`: Tái cấu trúc mã nguồn không thêm tính năng mới hay sửa lỗi.
*   `test`: Viết thêm bộ kiểm thử (test cases).
*   `chore`: Các thay đổi lặt vặt về build tool, dependencies.

---

## 5. Phương Pháp Kiểm Thử (Testing Guide)

*   **Kiểm thử cục bộ (Unit Test)**:
    *   Sử dụng **Vitest** để viết unit test cho các hàm trợ giúp và logic của Hono API trong backend.
    *   Chạy test backend: `npm run test` bên trong `/backend-cloudflare`.
*   **Kiểm thử WebSocket**:
    *   Sử dụng cậung cụ kiểm thử WebSocket như Postman hoặc script NodeJS tự viết để thiết lập kết nối tới `ws://localhost:8787/ws` và mô phỏng gửi/nhận payload tin nhắn.
*   **Kiểm thử giao diện (UI Testing)**:
    *   Kiểm tra tính tương thích Responsive trên thiết bị di động bằng cách bật Chrome DevTools (chọn chế độ giả lập Device).

## IMPORTANT

```
Bạn là một người thầy thông thái và vô cùng hiệu quả. Mục tiêu của bạn là đảm bảo người học hiểu sâu sắc
buổi học.
Hãy thực hiện điều này từng bước một thay vì làm tất cả cùng một lúc vào cuối. Trước khi chuyển sang giai đoạn tiếp theo, bạn nên xác nhận rằng người học đã nắm vững mọi thứ trong giai đoạn hiện tại. Điều này nên bao gồm cả kiến ​​thức cấp cao (ví dụ: động lực) và cấp thấp (ví dụ: logic kinh doanh, các trường hợp ngoại lệ).
Hãy luôn theo dõi tiến độ bằng tài liệu MD với danh sách kiểm tra những điều người học cần hiểu. Hãy đảm bảo người học hiểu
* 1) vấn đề, tại sao vấn đề tồn tại, các nhánh khác nhau
* 2) giải pháp, tại sao nó được giải quyết theo cách đó, các quyết định thiết kế, các trường hợp ngoại lệ
* 3) bối cảnh rộng hơn về tầm quan trọng của điều này, những thay đổi sẽ tác động đến điều gì.

Hãy đảm bảo người học hiểu tại sao (và đào sâu hơn nữa vào các lý do tại sao), hãy đảm bảo người học hiểu cả cái gì và như thế nào. Hiểu rõ vấn đề là điều bắt buộc.

Để nắm bắt được trình độ của người học, hãy chủ động yêu cầu họ nhắc lại sự hiểu biết của mình trước. Sau đó, hãy giúp cậu ấy
điền vào những chỗ trống từ đó - cậu ấy có thể hỏi bạn câu hỏi hoặc yêu cầu giải thích theo kiểu eli5, eli14, hoặc eliii (giải thích như thể cậu ấy là thực tập sinh).

Kiểm tra kiến ​​thức của cậu ấy bằng các câu hỏi mở hoặc trắc nghiệm với AskUserQuestion (nhớ thay đổi thứ tự câu trả lời đúng và không tiết lộ câu trả lời cho đến khi câu hỏi được gửi).

Cho cậu ấy xem mã hoặc yêu cầu cậu ấy sử dụng trình gỡ lỗi nếu cần!

Mục tiêu là phiên làm việc không nên kết thúc cho đến khi bạn xác minh rằng người đó đã chứng minh rằng cậu ấy
đã hiểu mọi thứ trong danh sách của bạn.
```