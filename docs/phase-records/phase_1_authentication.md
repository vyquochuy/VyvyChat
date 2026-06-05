# Tài Liệu Kỹ Thuật Phase 1: Xác Thực & Cài Đặt Không Gian Làm Việc

Tài liệu này tổng hợp các công nghệ, thuật toán, thư viện, lý thuyết và bài học kinh nghiệm được tích lũy sau khi hoàn thành Phase 1 của dự án **VivyChat** (Hệ thống Xác thực & Cấu trúc Monorepo).

---

## 1. Công Nghệ & Framework (Technologies & Frameworks)

Trong giai đoạn này, các công nghệ nền tảng đã được triển khai phục vụ cho cấu trúc Monorepo và môi trường Edge Computing:

*   **Cloudflare Workers**: Nền tảng serverless chạy trên V8 Isolates. Nhờ chạy tại biên (Edge), các yêu cầu của client được phản hồi nhanh hơn với độ trễ cực thấp.
*   **Hono Framework**: Một web framework siêu nhẹ, hiệu năng cực cao và tương thích hoàn hảo với môi trường Web Standards của Cloudflare Workers. Được dùng để phát triển các REST API route cho hệ thống Auth.
*   **Cloudflare D1**: Cơ sở dữ liệu quan hệ (chạy nhân SQLite) phân tán toàn cầu tại biên. Dùng để lưu trữ thông tin tài khoản người dùng (`users` table).
*   **Cloudflare KV**: Hệ thống lưu trữ Key-Value phân tán với tốc độ đọc cực nhanh, hỗ trợ cơ chế tự động xóa theo thời gian sống (TTL - Time To Live). Dùng để lưu trữ tạm thời OTP hash và thực hiện Rate Limiting.
*   **React (TypeScript) & Vite**: Bộ khung frontend hiện đại giúp phát triển giao diện nhanh chóng, tận dụng tối đa lợi ích của Static Typing và Hot Module Replacement (HMR).

---

## 2. Thuật Toán & Lý Thuyết (Algorithms & Theories)

*   **Băm mật khẩu PBKDF2 (SHA-256)**:
    *   *Lý thuyết*: Mật khẩu của người dùng không bao giờ được lưu dưới dạng văn bản thuần túy (plain text). Chúng tôi áp dụng chuẩn PBKDF2 (Password-Based Key Derivation Function 2) kết hợp salt ngẫu nhiên và 100,000 vòng lặp (iterations) để chống lại các cuộc tấn công Brute-force và Rainbow table.
    *   *Thuật toán*: Triển khai thông qua thư viện Web Crypto API tích hợp sẵn trong runtime của Cloudflare Workers.
*   **Thuật toán Rate Limiting (Sliding Window)**:
    *   *Ý tưởng*: Thay vì chia cửa sổ cố định dễ bị tấn công dồn dập ở ranh giới giữa hai cửa sổ (Fixed Window), Sliding Window chia nhỏ khoảng thời gian theo từng giây hoặc từng phút. Hệ thống sử dụng Cloudflare KV để theo dõi số lượng yêu cầu trong một khoảng thời gian động gần nhất của từng IP hoặc Email.
*   **Cơ chế OTP (One-Time Password) Authentication**:
    *   *Luồng xử lý*: Khi yêu cầu gửi OTP, một chuỗi 6 số ngẫu nhiên được sinh ra. Mã này được băm bằng SHA-256 trước khi lưu vào Cloudflare KV với TTL là 5 phút. Khi người dùng xác nhận đăng ký, mã gửi lên cũng được băm SHA-256 và so khớp trực tiếp với giá trị trong KV. Điều này đảm bảo OTP không bị lộ dù KV bị truy cập trái phép.
*   **Cơ chế khóa OTP tạm thời (Locked State)**:
    *   Đếm số lần thử OTP thất bại (tối đa 5 lần). Nếu vượt quá giới hạn, tiến hành khóa quá trình đăng ký của email đó để chống tấn công brute-force OTP, đồng thời hiển thị giao diện thông báo khóa và buộc người dùng quay lại màn hình Login.

---

## 3. Thư Viện & Công Cụ (Libraries & Tools)

*   **Web Crypto API (Native)**: Sử dụng các API mã hóa tiêu chuẩn trực tiếp từ môi trường runtime thay cho các thư viện JS ngoài (như `bcrypt` hay `crypto-js`), giúp tiết kiệm đáng kể dung lượng bundle size và CPU time của Worker.
*   **`@tsndr/cloudflare-worker-jwt`**: Thư viện JWT siêu nhẹ được thiết kế tối ưu riêng cho Cloudflare Workers, sử dụng các thuật toán mã hóa của Web Crypto API ở tầng dưới để ký và xác thực token JWT.
*   **TailwindCSS & PostCSS**: Framework CSS tiện ích giúp xây dựng giao diện nhanh, linh hoạt và tối ưu hóa CSS bundle đầu ra thông qua cơ chế loại bỏ lớp không dùng.

---

## 4. Kiến Thức Đúc Kết (Key Takeaways & Lessons Learned)

*   **Tối ưu hóa CPU Execution Time trên Worker**: 
    *   Cloudflare Workers phiên bản miễn phí có giới hạn 10ms CPU time cho mỗi request (50ms cho bản trả phí). Việc chạy các thư viện băm mật khẩu viết bằng JavaScript thuần (như `bcrypt.js`) sẽ dễ dàng làm vượt quá giới hạn này và gây ra lỗi `Exceeded CPU limit`.
    *   *Giải pháp*: Bắt buộc phải sử dụng Web Crypto API (`crypto.subtle`) cho mọi thao tác băm, ký số, hoặc giải mã vì nó chạy ở tầng C++ Native của V8 engine, cực kỳ nhanh và tốn rất ít CPU time.
*   **Quản lý Đồng bộ Dữ liệu KV**: 
    *   Cloudflare KV có tính chất *eventual consistency* (nhất quán sau cùng) trên toàn cầu. Điều này có nghĩa là khi một key được ghi, các node biên khác có thể mất vài giây để cập nhật giá trị mới nhất.
    *   *Ứng dụng*: KV hoàn toàn phù hợp để lưu trữ OTP và dữ liệu Rate Limiter vì các thao tác này thường diễn ra trên cùng một node biên gần người dùng nhất (nhờ định tuyến của Cloudflare) nên hiện tượng không nhất quán ít ảnh hưởng.
*   **Trải nghiệm người dùng đối với input OTP**:
    *   Thiết kế ô nhập OTP dạng phân tách (6 ô nhập số riêng biệt) đòi hỏi phải xử lý cẩn thận các sự kiện `onKeyDown`, `onChange`, `onPaste` và tự động di chuyển con trỏ (focus) để mang lại trải nghiệm mượt mà nhất trên cả máy tính lẫn thiết bị di động.
