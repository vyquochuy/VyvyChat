# Tài Liệu Hướng Dẫn Lý Thuyết Dự Án (Email-Verify)

Chào mừng bạn đến với thư mục tài liệu lý thuyết của dự án **Email-Verify**! 

Dự án này tuy nhỏ nhưng được xây dựng trên một kiến trúc hiện đại, kết hợp giữa **Serverless Computing (Edge computing)**, **NoSQL KV Databases**, **Mã hóa bảo mật**, và **Webhooks**. Để giúp bạn làm quen và hiểu sâu hơn về lý thuyết đằng sau các công nghệ này, tài liệu được chia làm 7 chuyên đề rất chi tiết và dễ hiểu dưới đây:

---

## Danh Sách Chuyên Đề Học Tập

| # | Chủ Đề | Nội Dung Tóm Tắt |
|---|---|---|
| 1 | [**Cloudflare Workers & Serverless**](cloudflare-workers.md) | Tìm hiểu về Điện toán đám mây thế hệ mới, chạy code tại Edge và V8 Isolates. |
| 2 | [**Hono Framework**](hono-framework.md) | Web framework siêu nhẹ, cực kỳ nhanh chạy trực tiếp trên môi trường Edge. |
| 3 | [**Cloudflare KV (Key-Value Store)**](cloudflare-kv.md) | Hệ thống lưu trữ dữ liệu NoSQL phân tán toàn cầu, cơ chế TTL và Eventual Consistency. |
| 4 | [**Security & Cryptography (Bảo mật & Mã hóa)**](cryptography-security.md) | Tại sao phải băm SHA-256? Web Crypto API hoạt động thế nào trong Cloudflare Workers? |
| 5 | [**Webhook & Google Apps Script (GAS)**](webhooks-gas.md) | Giải pháp gửi email miễn phí, an toàn mà không cần dựng SMTP Server riêng. |
| 6 | [**CORS (Cross-Origin Resource Sharing)**](cors-flow.md) | Tại sao trình duyệt chặn API của bạn? Cơ chế hoạt động của CORS và cách giải quyết. |
| 7 | [**Tailwind CSS (Utility-First Style)**](7-tailwind-css.md) | Cách mạng hóa thiết kế giao diện bằng các class tiện ích, responsive mobile và tối ưu JIT. |

---

## Lời Khuyên Khi Đọc Tài Liệu

- **Đối với người mới bắt đầu**: Nên đọc theo thứ tự từ **Chuyên đề 1** đến **Chuyên đề 7** để nắm được bức tranh toàn cảnh từ hạ tầng (Workers) cho đến logic ứng dụng, bảo mật và thiết kế giao diện.
- **Có ví dụ thực tế**: Mỗi bài học đều có so sánh với các công nghệ truyền thống (như Node.js/Express, database SQL thường gặp) để bạn dễ liên tưởng nhất.
- **Liên hệ thực tế dự án**: Các tài liệu sẽ chỉ ra chính xác đoạn code nào trong file `backend-cloudflare/src/index.ts` hay `frontend/app.js` đang sử dụng lý thuyết đó.

---

## Nhật Ký Kỹ Thuật Theo Phase (Phase Records)

Để lập trình viên hiểu và học tập, tài liệu lưu trữ dưới đây ghi nhận lại các quyết định thiết kế, thư viện, thuật toán và bài học kinh nghiệm sau mỗi giai đoạn phát triển:

*   [**Phase 1: Xác Thực & Cài Đặt Không Gian Làm Việc**](phase-records/phase_1_authentication.md)
*   [**Phase 2: Hệ Thống Bạn Bè & Tìm Kiếm**](phase-records/phase_2_friend_system.md)
*   [**Phase 3: Giao Diện Chat Cơ Bản**](phase-records/phase_3_basic_chat_interface.md)

