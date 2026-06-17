## PHASE 1A — Messenger Bridge

### Mục tiêu

Cho phép người dùng kết nối tài khoản Messenger với VyVyChat.

### Kết quả cuối cùng

Người dùng mở VyVyChat:

```text
Messenger
✓ Connected
```

và có thể xem tin nhắn Messenger trong VyVyChat.

---

## Nghiên cứu trước

Đây là thứ ông cần xác định đầu tiên:

### Messenger có API cho việc này không?

Câu trả lời gần như là:

```text
KHÔNG
```

API của Meta chủ yếu dành cho:

- Facebook Pages
- Instagram Business
- WhatsApp Business

Messenger cá nhân gần như không có API công khai.

---

### Vì vậy có 3 lựa chọn

#### Cách 1

Import file export từ Facebook.

Người dùng:

```text
Facebook
→ Download Your Information
→ Messages
→ JSON
```

Sau đó upload vào VyVyChat.

---

Ưu điểm:

- Hợp pháp
- Không vi phạm ToS
- Làm được ngay

---

#### Cách 2

Browser Extension

Ví dụ:

```text
Chrome Extension
```

đọc Messenger Web.

---

Rủi ro:

- Meta thay đổi DOM là hỏng.

---

#### Cách 3

Reverse Engineering

Giống các project:

- mautrix-facebook
- beeper

---

Rất khó.

Dễ bị Meta chặn.

---

# Tôi khuyên dùng Cách 1

---

# PHASE 1B — Messenger Import Engine

## Mục tiêu

Import dữ liệu Messenger.

---

### Input

```json
{
  "participants": [...],
  "messages": [...]
}
```

---

### Output

Schema chuẩn của VyVyChat.

```ts
interface UnifiedMessage {
  id: string;

  source: "messenger";

  conversationId: string;

  senderId: string;

  senderName: string;

  content: string;

  timestamp: number;
}
```

---

### Công nghệ

Backend:

```text
Hono
```

Storage:

```text
D1
```

---

### Deliverables

Import được:

```text
100k+
messages
```

---

# PHASE 6C — Memory Index

## Mục tiêu

Sau khi import xong.

Tạo index.

---

### Message Pipeline

```text
Message
↓
Clean Text
↓
Normalize
↓
Store
↓
Index
```

---

### Công nghệ

D1 FTS5

Ví dụ:

```sql
CREATE VIRTUAL TABLE message_search
USING fts5(
    content,
    conversation_id
);
```

---

### Deliverables

Search:

```text
cloudflare

oracle

postgres
```

trong vài mili giây.

---

# PHASE 7A — Semantic Search

Bây giờ mới tới AI.

---

## Mục tiêu

Người dùng hỏi:

```text
database nhóm chọn là gì
```

---

Tin nhắn thực tế:

```text
mình dùng PostgreSQL nhé
```

---

vẫn tìm được.

---

### Pipeline

```text
Message
↓
Embedding
↓
Vector
↓
Store
```

---

### Công nghệ

Nếu đang dùng Cloudflare:

- Workers AI Embeddings
- Vectorize

Rất hợp với stack hiện tại của ông.

---

### Schema

```ts
Message;

Embedding;

Conversation;
```

---

### Deliverables

Semantic Search hoạt động.

---

# PHASE 7B — Search UI

Đây mới là thứ người dùng thấy.

---

Ví dụ:

```text
🔍 Search Memory
```

---

User nhập:

```text
e2ee
```

---

Hiển thị:

```text
Conversation:
VyVyChat Team

Date:
2026-06-12

"...ECDH P-256..."
```

---

# PHASE 8 — Conversation Memory

Lúc này mới có thứ khác biệt.

---

## Mục tiêu

Tự động phát hiện:

### Decisions

Ví dụ:

```text
Dùng PostgreSQL nhé.
```

↓

```text
Decision:
Database = PostgreSQL
```

---

### Tasks

Ví dụ:

```text
Tao sẽ làm backend.
```

↓

```text
Task:
Backend
Owner: Huy
```

---

### Deadlines

Ví dụ:

```text
Deadline 30/06.
```

↓

```text
Deadline:
30/06
```

---

### Công nghệ

Gemini Flash.

Chi phí cực thấp.

---

# PHASE 9 — Memory Assistant

Bây giờ mới có chatbot.

---

User:

```text
Nhóm đã quyết định gì về database?
```

---

Pipeline:

```text
Question
↓
Search
↓
Top 20 Messages
↓
Gemini
↓
Answer
```

---

Trả lời:

```text
Ngày 12/06 nhóm quyết định sử dụng PostgreSQL.

Nguồn:
- Nguyễn Văn A
- 12/06/2026
```

---
