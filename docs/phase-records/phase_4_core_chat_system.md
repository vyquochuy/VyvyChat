# Tài Liệu Kỹ Thuật Phase 4: Hệ Thống Chat Cốt Lõi & Durable Objects

Tài liệu này tổng hợp các công nghệ, thuật toán, quyết định thiết kế kiến trúc và bài học kinh nghiệm tích lũy sau khi hoàn thành Phase 4 của dự án **VivyChat** (Thiết lập kết nối thời gian thực bằng WebSockets, quản lý trạng thái bằng Durable Objects, tối ưu hóa ghi gộp CSDL và tự động khôi phục kết nối).

---

## 1. Công Nghệ & Framework (Technologies & Frameworks)

*   **Cloudflare Durable Objects (DO)**: 
    *   **`ConversationDO`**: Đại diện cho mỗi phòng chat (DIRECT). Duy trì kết nối WebSocket của các thành viên đang trực tuyến trong phòng, quản lý hàng đợi tin nhắn trong RAM và thực hiện đồng bộ.
    *   **`UserPresenceDO`**: Quản lý trạng thái trực tuyến của mỗi người dùng riêng biệt trên bộ nhớ RAM biên (in-memory Edge).
*   **WebSockets**: Giao thức kết nối hai chiều liên tục thế hệ mới được tích hợp trực tiếp trên Cloudflare Workers và Durable Objects.
*   **Hono Framework**: Router Gateway đứng đầu tiếp nhận yêu cầu nâng cấp kết nối (Upgrade WebSocket) và định tuyến thông minh đến các Durable Object stubs tương ứng.
*   **React (TypeScript) & Zustand**: Quản lý đa luồng kết nối WebSocket (Presence WS và Active Chat WS) và cập nhật tức thời giao diện người dùng dựa trên thay đổi trạng thái (State-driven UI).

---

## 2. Thuật Toán & Lý Thuyết (Algorithms & Theories)

### 2.1. Cơ chế Write-behind Cache với Buffer An Toàn (Zero Data Loss)
Để giảm thiểu số lượng truy vấn ghi liên tục vào SQLite (D1 Database) tránh gây tắc nghẽn (bottleneck) khi có lưu lượng lớn:
1. Khi có tin nhắn mới gửi lên WebSocket, `ConversationDO` lập tức ghi đệm tạm vào lưu trữ riêng của DO thông qua:
   ```typescript
   await this.state.storage.put(msgId, newMsg)
   ```
2. Phát sóng (broadcast) tin nhắn tức thời đến các thành viên trong phòng chat và đưa tin nhắn vào mảng cache trên RAM.
3. Kích hoạt tự động ghi gộp (Batch Insert) xuống D1 khi thỏa mãn một trong các điều kiện:
   - Cache đạt ngưỡng đầy: `messageCache.length >= 50` tin nhắn.
   - Thời gian trễ trôi qua: Đã qua `2 giây` (trong môi trường dev) hoặc `5 giây` (trong môi trường prod).
   - Ngắt kết nối phòng chat: Không còn bất kỳ WebSocket Client nào hoạt động trong phòng (`sessions.size === 0`).
4. Khi ghi gộp vào D1 thành công, tiến hành xóa hàng loạt tin nhắn khỏi DO storage để giải phóng dung lượng.
5. **Cơ chế khôi phục (Recovery):** Nếu Durable Object bị dừng đột ngột hoặc evict bởi Cloudflare, trong hàm dựng (constructor/blockConcurrencyWhile), hệ thống tự động quét DO storage, lấy ra các tin nhắn chưa kịp ghi và flush ngay xuống D1, cam kết **không bao giờ mất dữ liệu tin nhắn**.

### 2.2. Kiến Trúc Presence Không Fan-out (Scalable Presence)
Nhằm tránh tình trạng quá tải cuộc gọi chéo (DO calls) giữa các Durable Objects bạn bè:
- Mỗi `UserPresenceDO` chịu trách nhiệm độc lập hoàn toàn trạng thái `online`/`offline` của chính User đó thông qua heartbeat Ping-Pong 15 giây.
- Khi người dùng thay đổi trạng thái, hệ thống cập nhật in-memory và ghi xuống trường `updated_at` trong D1 làm mốc *last seen* lúc ngắt kết nối.
- Frontend không nhận thông báo đẩy thụ động, mà chủ động gọi API `/api/users/presence?ids=id1,id2,...` để truy vấn song song trực tiếp từ RAM của stubs DO tương ứng, mang lại tốc độ phản hồi cực nhanh (<10ms).

### 2.3. Exponential Backoff với Jitter Ngẫu Nhiên
Nhằm chống hiện tượng nghẽn mạng cục bộ (Thundering Herd Problem) khi hàng ngàn client cùng kết nối lại sau khi máy chủ khởi động lại:
$$delay = baseDelay \times 2^{retryCount} + \text{random}(0, 1000)\text{ ms}$$
Công thức này chèn thêm một lượng thời gian trễ ngẫu nhiên (Jitter) giúp phân tán thời điểm kết nối của các client, đảm bảo hệ thống phục hồi êm ái.

### 2.4. Phân Trang Tin Nhắn Chỉ Mục Kết Hợp (Cursor Pagination with Composite Index)
Thay vì sử dụng `OFFSET` truyền thống gây chậm dần khi lịch sử tin nhắn phình to, hệ thống sử dụng **Cursor Pagination** kết hợp chỉ mục phức hợp để sắp xếp và lọc dữ liệu:
```sql
CREATE INDEX IF NOT EXISTS idx_messages_paginated 
ON messages(conversation_id, created_at DESC, id DESC);

SELECT * FROM messages 
WHERE conversation_id = ? AND created_at < ? 
ORDER BY created_at DESC 
LIMIT 50;
```
Bộ khóa kết hợp `(conversation_id, created_at DESC, id DESC)` đảm bảo phân biệt chính xác thứ tự các tin nhắn có cùng timestamp tạo.

---

## 3. Thư Viện & Công Cụ (Libraries & Tools)

*   **`hono/jwt`**: Thư viện chuẩn nhẹ để giải mã xác thực token người dùng ngay trước khi nâng cấp giao thức WebSocket.
*   **Wrangler v3 CLI**: Hỗ trợ môi trường phát triển giả lập Durable Objects cục bộ cực kỳ mạnh mẽ mà không cần deploy lên Cloudflare Dashboard.

---

## 4. Kiến Thức Đúc Kết (Key Takeaways & Lessons Learned)

### 4.1. Xác thực JWT an toàn trên WebSockets
Trình duyệt không hỗ trợ đính kèm Custom Headers (như `Authorization: Bearer <token>`) vào constructor `new WebSocket()`. 
- **Giải pháp:** Truyền token an toàn qua Query Parameter (`?token=...`).
- **Bảo mật:** Không ghi log URL kết nối để tránh lộ lọt token trong nhật ký máy chủ. Thực hiện xác thực JWT nghiêm ngặt ngay trên Gateway Worker trước khi gọi `server.accept()` để tránh lãng phí vòng đời của Durable Objects cho các kết nối giả mạo.

### 4.2. Khắc phục lỗi kiểu dữ liệu tham số Hono
Trong TypeScript nghiêm ngặt, kiểu dữ liệu trả về từ hàm `c.req.param('id')` của Hono có thể có giá trị `undefined`, trong khi hàm sinh định danh Durable Object `c.env.CONVERSATION_DO.idFromName(id)` yêu cầu kiểu `string` tuyệt đối.
- **Giải pháp:** Sử dụng toán tử fallback `c.req.param('id') || ''` kết hợp kiểm tra độ dài chuỗi để đảm bảo an toàn kiểu dữ liệu tại thời điểm biên dịch và runtime.
