# Phase 6: Advanced Realtime & End-to-End Encryption Infrastructure

> **Thời gian thực hiện**: Tuần 6  
> **Trạng thái**: ✅ Hoàn thành

---

## 1. Mục tiêu Phase

Nâng cấp hệ thống chat VivyChat lên chuẩn bảo mật E2EE mặc định cho toàn bộ tin nhắn (giống Signal/WhatsApp), đồng thời tích hợp các tính năng realtime nâng cao: Typing Indicator và Toast Notification cho tin nhắn từ phòng chat không đang mở.

---

## 2. Công nghệ & Framework sử dụng

### Backend (Cloudflare Workers / Hono)
| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|---------|
| Hono | ^4.3.7 | HTTP framework Cloudflare Workers |
| Cloudflare D1 (SQLite) | — | Lưu trữ ciphertext tin nhắn và lịch sử khóa |
| Cloudflare Durable Objects | — | ConversationDO (typing + notification push), UserPresenceDO (toast relay) |

### Frontend (React + Vite + TypeScript)
| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|---------|
| Web Crypto API | Browser Native | ECDH, AES-GCM, PBKDF2 — không cần npm package |
| IndexedDB | Browser Native | Lưu CryptoKey phi chiết xuất an toàn |
| Zustand | — | State management (thêm typingFriends) |
| React | ^18 | UI components |

---

## 3. Thuật toán & Lý thuyết cốt lõi

### 3.1 End-to-End Encryption (E2EE)

**Luồng tạo cặp khoá và chia sẻ Shared Secret:**
```
Alice                           Server                         Bob
  |                               |                             |
  |-- generateKey(ECDH P-256) --> |                             |
  |   [PublicKey_A, PrivKey_A]    |                             |
  |-- POST /auth/keys/setup ----→ |                             |
  |   { publicKey: PubKey_A_JWK } |                             |
  |                               |<-- GET /friends ----------- |
  |                               |--- { publicKey: PubKey_A } ->|
  |                               |                             |
  |   Alice muốn nhắn Bob:        |                             |
  |   SharedSecret = ECDH(        |                             |
  |     PrivKey_A,                |                             |
  |     PubKey_B                  |                             |
  |   )                           |                             |
  |   → AES-256-GCM Key           |                             |
  |   → encrypt(plaintext)        |                             |
  |   = ciphertext                |                             |
  |-- WS send ciphertext -------> |--- broadcast ciphertext ---> |
  |                               |                             |
  |                               |   Bob: decrypt(ciphertext,  |
  |                               |     ECDH(PrivKey_B, PubKey_A)|
  |                               |   ) = plaintext             |
```

**Thuật toán sử dụng:**
- **ECDH P-256**: Trao đổi khoá — không truyền khoá thực qua mạng
- **AES-256-GCM**: Mã hoá đối xứng với IV 96-bit ngẫu nhiên cho mỗi tin nhắn
- **PBKDF2 (SHA-256, 260.000 vòng)**: Dẫn xuất khoá từ Recovery Password để bảo vệ backup Private Key

### 3.2 Lưu trữ Private Key an toàn (IndexedDB + extractable: false)

```
Recovery Password
      ↓
PBKDF2 (260k rounds + random salt 128-bit)
      ↓
AES-256-GCM key (derivedKey)
      ↓ encrypt(PrivateKey_JWK)
encrypted_private_key  →  lưu lên Server (D1)

Khi khôi phục thiết bị mới:
      ↓
decrypt(encrypted_private_key, PBKDF2(Recovery Password, salt))
      ↓
PrivateKey_JWK
      ↓
crypto.subtle.importKey(jwk, { extractable: false })
      ↓
CryptoKey  →  IndexedDB (JS không thể đọc giá trị thô, chống XSS)
```

### 3.3 Key Versioning (Phiên bản khóa)

Mỗi cặp khoá mang một `key_version` số nguyên tăng dần. Khi xoay vòng khoá (`Reset Encryption`), `key_version` tăng 1. Mỗi tin nhắn mã hoá lưu:
```json
{
  "encrypted": true,
  "ciphertext": "<hex>",
  "iv": "<hex>",
  "senderKeyVersion": 1,
  "recipientKeyVersion": 1
}
```

Bảng `user_public_keys` lưu toàn bộ lịch sử khoá công khai, cho phép giải mã tin nhắn cũ ngay cả sau khi xoay vòng khoá (nếu thiết bị vẫn còn khóa riêng tư phiên bản cũ trong IndexedDB).

### 3.4 Typing Indicator (Debounce Pattern)

```
User gõ phím
      ↓
sendTypingStatus(true) → WS send { type: 'typing', isTyping: true }
      ↓
ConversationDO.broadcastExcept(sender, { type: 'typing', sender_id, isTyping: true })
      ↓
Đối phương nhận → setTyping(friendId, true)
      ↓
ChatArea hiển thị 3 chấm nhảy (animate-bounce)
      ↓
Debounce 3s không gõ → sendTypingStatus(false) → tắt animation
```

### 3.5 Toast Notification Push (Cross-Room)

```
User A gửi tin nhắn trong ConversationDO (room A-B)
      ↓
ConversationDO kiểm tra: B có đang kết nối vào room này không?
      ↓ (B không kết nối vào room)
ConversationDO → POST /send-notification → UserPresenceDO của B
      ↓
UserPresenceDO broadcast sự kiện { type: 'new_message', ... } qua WebSocket Presence
      ↓
Frontend B nhận qua usePresenceSocket → showToast + addMessage vào store
```

---

## 4. Thư viện & Công cụ

| Tên | Loại | Lý do |
|-----|------|-------|
| Web Crypto API | Browser Built-in | ECDH, AES-GCM, PBKDF2 — zero dependencies, tốc độ native |
| IndexedDB | Browser Built-in | Lưu CryptoKey phi chiết xuất — an toàn hơn localStorage |
| Zustand `typingFriends` | State update | Reactivity typing indicator không cần global context |

> **Lưu ý**: Không cần cài thêm npm package nào cho E2EE. Web Crypto API đủ mạnh và là chuẩn W3C.

---

## 5. Thay đổi Database Schema

### Migration `0006_add_encryption_keys.sql`

```sql
-- Thêm cột khóa vào users
ALTER TABLE users ADD COLUMN public_key TEXT;
ALTER TABLE users ADD COLUMN encrypted_private_key TEXT;
ALTER TABLE users ADD COLUMN recovery_salt TEXT;
ALTER TABLE users ADD COLUMN key_version INTEGER DEFAULT 1;

-- Bảng lịch sử khóa công khai
CREATE TABLE IF NOT EXISTS user_public_keys (
  user_id TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key_version),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_public_keys_lookup ON user_public_keys(user_id, key_version);
```

---

## 6. Các API Endpoint mới

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/auth/keys/setup` | Thiết lập/xoay vòng cặp khoá E2EE |
| `GET` | `/api/auth/keys` | Lấy thông tin khoá để khôi phục thiết bị mới |
| `GET` | `/api/users/:id/public-keys` | Lấy lịch sử khoá công khai (giải mã tin nhắn cũ) |
| `POST` | `/ws/presence → /send-notification` | Internal: UserPresenceDO relay toast notification |

---

## 7. Kiến thức đúc kết

### 7.1 `extractable: false` là bắt buộc
Khi import Private Key vào bộ nhớ sau khi khôi phục hoặc tạo mới, luôn dùng `extractable: false`. Điều này đảm bảo mã JavaScript độc hại (XSS) không thể gọi `exportKey()` để lấy thô giá trị khoá.

### 7.2 IndexedDB serialize được CryptoKey
Browser hỗ trợ serialize `CryptoKey` vào IndexedDB thông qua `structured clone algorithm`. Nghĩa là ta có thể lưu `CryptoKey` trực tiếp vào IDB mà không cần convert sang format khác.

### 7.3 PBKDF2 iterations tối thiểu 260.000 (2026)
OWASP khuyến nghị tối thiểu 600.000 iterations cho PBKDF2-SHA256 đối với mật khẩu người dùng. Dự án chọn 260.000 làm mức cân bằng UX/bảo mật (mobile devices). Có thể nâng lên 600.000 trong production.

### 7.4 Cấu trúc JSON cho ciphertext thay vì prefix string
Dùng `{ "encrypted": true, "ciphertext": "...", ... }` thay vì `__E2EE__:ciphertext:iv` giúp:
- Dễ thêm trường mới (algorithm, keyId, attachments...)
- Parser rõ ràng, không cần split string thủ công
- Tương thích ngược dễ hơn

### 7.5 Shared Key Cache (in-memory)
`sharedKeyCache` dùng `Map<string, CryptoKey>` trong `useRef` để tránh gọi `deriveKey()` (ECDH) lặp lại cho mỗi tin nhắn. Khoá được xoá khỏi cache khi xoay vòng khoá.

### 7.6 Phân tách Typing Indicator và Toast Notification
- **Typing**: `ConversationDO.broadcastExcept()` — gửi trong phòng, không ra ngoài
- **Toast**: `ConversationDO` → `UserPresenceDO.send-notification` → Presence WebSocket → Client — luồng cross-DO

### 7.7 Cô lập không gian lưu trữ IndexedDB theo từng tài khoản (Multi-account isolation)
- Lưu trữ gộp tất cả các trường khóa E2EE (`privateKey`, `publicKeyJwk`, `keyVersion`) thành một đối tượng duy nhất dạng `StoredKeyData` dưới khóa có dạng `e2ee:${userId}`.
- Việc này giúp các tài khoản khác nhau trên cùng một thiết bị không bị ghi đè hoặc đọc nhầm khóa E2EE của nhau.

### 7.8 Unmount Provider và Giải phóng Runtime Cache
- Đưa `SecretChatProvider` vào bên trong `Dashboard` thay vì cấp độ gốc. Khi người dùng đăng xuất, component `Dashboard` unmount sẽ tự động giải phóng toàn bộ `useRef` lưu cache (`sharedKeyCache`, `publicKeyHistoryCache`) và state E2EE khỏi bộ nhớ.

### 7.9 Cơ chế giải mã tin nhắn tự gửi (Self-decryption)
- Khi giải mã tin nhắn, phân biệt cờ `isOutgoing` để so khớp chính xác khóa cần dùng. Người gửi dùng `senderKeyVersion` để so sánh với khóa hiện tại, người nhận dùng `recipientKeyVersion`.

---

## 8. Verification Checklist

- [x] TypeScript compile thành công (`npx tsc --noEmit`)
- [x] D1 migration áp dụng thành công (local)
- [x] Kiểm tra E2EE end-to-end: ciphertext trong D1
- [x] Kiểm tra Typing Indicator animation giữa 2 client
- [x] Kiểm tra Toast Notification khi nhận tin nhắn từ phòng khác
- [x] Kiểm tra luồng khôi phục thiết bị mới (Recovery Password)
- [x] Kiểm tra luồng Reset Encryption (Key Rotation)
