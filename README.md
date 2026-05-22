# Email Verification Service

<div align="center">

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-200A3A?style=for-the-badge&logo=Cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

**Backend Serverless sử dụng Cloudflare Workers để gửi và xác thực mã OTP qua Email.**

[Tổng quan](#-mục-tiêu) • [Công nghệ](#-công-nghệ) • [Cấu trúc](#-cấu-trúc-thư-mục) • [Cài đặt & Cấu hình](#-cài-đặt--cấu-hình) • [Test Locally](#-test-local) • [Deploy](#-deploy-lên-cloudflare-cloud) • [Cấu hình GAS Webhook](#-cấu-hình-gas-webhook)

</div>

---

## 📋 Mục tiêu

Xây dựng một backend API hoàn toàn không máy chủ (Serverless) để xử lý quy trình xác thực email bằng Mã OTP (One-Time Password), được triển khai trên hạ tầng Cloudflare Workers.

### Các chức năng chính:

1.  **Send OTP**: Gửi mã OTP 6 chữ số ngẫu nhiên vào email người dùng chỉ định.
2.  **Verify OTP**: Xác thực mã OTP người dùng nhập, kiểm tra tính hợp lệ và thời gian hết hạn (60 giây).
3.  **Rate Limiting**: Tự động giới hạn tần suất gửi OTP (tối đa 1 lần/60 giây cho mỗi email) để chống spam.

---

## 🧪 Công nghệ sử dụng

-   **Cloudflare Workers**: Nền tảng điện toán biên (Edge Computing) để chạy code gần người dùng.
-   **TypeScript**: Ngôn ngữ lập trình với kiểu dữ liệu tĩnh giúp tăng cường tính ổn định của code.
-   **wrangler CLI**: Công cụ dòng lệnh chính thức của Cloudflare để phát triển và deploy Worker.
-   **Cloudflare KV (Key-Value Store)**: Cơ sở dữ liệu NoSQL dạng key-value phân tán, được sử dụng để lưu trữ mã OTP và thông tin session tạm thời.
-   **Google Apps Script (GAS)**: Được tích hợp để gửi email thông qua Webhook (sử dụng hàm `MailApp.sendEmail`).

---

## 📂 Cấu trúc thư mục

```
email-verify-worker/
├── src/
│   ├── index.ts           # Entry point - Định nghĩa routes API (sendOTP, verifyOTP)
│   └── worker.ts          # Logic chính: Business logic, request handling, KV operations
├── package.json           # Khai báo dependencies và scripts
├── tsconfig.json          # Cấu hình TypeScript
├── wrangler.toml          # Cấu hình tài nguyên Cloudflare (KV, secrets)
└── AGENT.md               # Tài liệu hướng dẫn làm việc với AI
```

---

## 🚀 Cài đặt & Cấu hình

### Bước 1: Cài đặt Dependencies

Mở terminal trong thư mục gốc dự án và chạy:

```bash
npm install
```

### Bước 2: Kết nối Cloudflare Tài khoản

Để chạy và deploy Worker, bạn cần xác thực tài khoản Cloudflare. Chạy lệnh sau và làm theo hướng dẫn:

```bash
npx wrangler login
```

### Bước 3: Cấu hình Wrangler (wrangler.toml)

Mở file `wrangler.toml`. Bạn cần đảm bảo phần cấu hình `[[kv_namespaces]]` đã chính xác với tài nguyên KV của bạn trên Cloudflare Dashboard.

```toml
# ... (Các phần khác giữ nguyên) ...

[[kv_namespaces]]
binding = "OTP_KV"
id = "<ID-Tài-nguyên-KV-của-bạn>"
# Ví dụ: id = "13ac87ee4dd8484faafc9613dce6a795"

[vars]
# Link Webhook của Google Apps Script (Sẽ cấu hình ở Bước 5)
# GAS_WEBHOOK_URL = "<YOUR-GAS-WEBHOOK-URL>"
```

> **Lưu ý:** Nếu bạn chưa tạo KV Namespace, hãy vào **Cloudflare Dashboard** -> **Workers & Pages** -> Chọn Worker -> **Settings** -> **Variables** -> **KV Namespace** để tạo mới, sau đó cập nhật ID vào file này.

---

## 💻 Test Local

Wrangler cho phép bạn mô phỏng môi trường Cloudflare ngay trên máy tính.

### 1. Chạy chế độ Development

Lệnh này sẽ khởi động một server local, thường ở cổng 8787 hoặc 9999.

```bash
npx wrangler dev
```

Khi server chạy, terminal sẽ hiển thị URL local (ví dụ: `http://localhost:8787`). Bạn có thể dùng API Testing tools như Postman, Insomnia hoặc Flutter app để gọi đến URL này để test.

### 2. Sử dụng Mock Variables (Tùy chọn)

Tạo file `.dev.vars` trong thư mục dự án (nếu chưa có) để định nghĩa các biến môi trường dùng riêng cho local dev:

```env
# .dev.vars
GAS_WEBHOOK_URL=https://example.com/mock-webhook-url
```

---

## 🔮 Deploy lên Cloudflare Cloud

Khi đã hoàn thành cấu hình và kiểm thử local thành công, bạn có thể đẩy ứng dụng lên Cloudflare:

```bash
npm run deploy
```

### Lời khuyên sau khi Deploy

-   **Thời gian đồng bộ**: Sau khi deploy lần đầu, Cloudflare cần **5 - 15 phút** để kích hoạt và đồng bộ chứng chỉ SSL cho Subdomain mới. Bạn có thể gặp lỗi `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` ngay lúc đầu, hãy chờ một chút rồi thử lại.
-   **Lấy URL Production**: Sau khi deploy, Terminal sẽ hiển thị URL production (ví dụ: `https://account-manager-backend.your-subdomain.workers.dev`). Hãy sử dụng link này trong ứng dụng Flutter của bạn.

---

## 🔗 Cấu hình GAS Webhook (Google Apps Script)

Để ứng dụng gửi được email, bạn cần một Web App trong Google Apps Script nhận request và gửi email thay mặt bạn.

### Hướng dẫn tạo Web App:

1.  Truy cập [Google Apps Script Editor](https://script.google.com).
2.  Tạo một dự án mới.
3.  Paste đoạn code dưới đây vào file `Code.gs`:

```javascript
// Code.gs - GAS Web App for Email Verification

// Tên miền miền trắng (whitelist) của bạn
const WHITELIST = ['example.com', 'gmail.com'];

// Hàm xử lý HTTP GET request (để gửi email)
function doGet(e) {
  try {
    const query = e.parameter;

    // 1. Kiểm tra email bắt buộc
    const to = query.to;
    if (!to) return ContentService.createTextOutput(JSON.stringify({
      success: false, 
      error: "Missing 'to' parameter (email address)."
    })).setMimeType(ContentService.MimeType.JSON);

    // 2. Kiểm tra tên miền: Chỉ cho phép các miền trong whitelist
    const emailDomain = to.split('@')[1];
    if (!emailDomain || !WHITELIST.includes(emailDomain)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, 
        error: "Domain not allowed for security reasons."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const subject = query.subject || "Mã OTP Xác thực";
    const body = query.body || "Không có nội dung. Vui lòng kiểm tra lại.";

    // 3. Gửi email bằng tài khoản Google của bạn
    MailApp.sendEmail(to, subject, body);

    return ContentService.createTextOutput(JSON.stringify({success: true}));
  } catch (err) {
    return ContentService
