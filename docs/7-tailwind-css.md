# Chuyên Đề 7: Tailwind CSS - Cách Mạng Hóa Quy Trình Thiết Kế Giao Giao Diện Bằng Utility-First

Khi xây dựng một ứng dụng web hiện đại như **VivyChat**, việc thiết kế giao diện giao diện (UI) là một trong những bước tốn nhiều thời gian nhất. Cách tiếp cận truyền thống là viết CSS trong các tệp `.css` riêng biệt, hoặc tệ hơn là lạm dụng **Inline Styles** trực tiếp trong HTML/React.

Để giải quyết triệt để các vấn đề về hiệu năng, tốc độ phát triển và tính đồng bộ thiết kế, dự án của chúng ta sử dụng **Tailwind CSS** - một thư viện CSS theo trường phái **Utility-First** (Tiện ích trước tiên).

Tailwind CSS không giống như các framework truyền thống (như Bootstrap) với một danh sách cố định các class (như `btn` hay `card`). Thay vào đó, nó là một **Utility-first framework** cung cấp hàng ngàn class nhỏ, mỗi class tương ứng với một thuộc tính CSS duy nhất.

Đặc biệt, với cơ chế **JIT (Just-In-Time) compiler**, Tailwind không "cài đặt" hay tải sẵn toàn bộ class làm nặng trang web. Nó sẽ quét code của bạn (HTML, JSX, Vue...) và **chỉ tạo ra mã CSS cho những class bạn thực sự gõ ra**.

---

## 1. Phương pháp "Utility-First" là gì?

> [!TIP]  
> Thay vì thiết kế một lớp (class) tổng quát như `.btn-primary` chứa 10 dòng thuộc tính CSS, **Utility-First** cung cấp hàng ngàn các lớp đơn nhiệm siêu nhỏ (utility classes) như `bg-blue-500`, `px-4`, `py-2`, `rounded` để bạn ghép trực tiếp vào thẻ HTML.

### Hãy so sánh sự khác biệt:

#### Cách 1: Thiết kế truyền thống (Semantic CSS)
*   **HTML:**
    ```html
    <div class="chat-bubble-sender">Xin chào!</div>
    ```
*   **CSS (Tệp bên ngoài):**
    ```css
    .chat-bubble-sender {
      background-color: #8a2be2;
      padding: 10px 14px;
      border-radius: 16px 16px 2px 16px;
      color: white;
      font-size: 14px;
      text-align: left;
    }
    ```
*   **Hạn chế:** Bạn phải liên tục chuyển đổi qua lại (Context Switching) giữa file HTML/React và file CSS chỉ để chỉnh sửa một vài pixel. Tên class cũng dễ bị trùng lặp hoặc phình to khi dự án lớn dần.

#### Cách 2: Thiết kế bằng Tailwind CSS
*   **HTML/React:**
    ```html
    <div class="bg-[var(--color-purple)] px-3.5 py-2.5 rounded-[16px_16px_2px_16px] text-white text-sm text-left">
      Xin chào!
    </div>
    ```
*   **Lợi ích:** Bạn chỉnh sửa giao diện ngay tại chỗ mà không cần mở file CSS. Mọi thuộc tính đều tường minh và trực quan.

---

## 2. Bảng so sánh: Tailwind CSS vs Bootstrap vs Custom CSS

| Tiêu Chí | Custom CSS truyền thống | Bootstrap | Tailwind CSS |
|---|---|---|---|
| **Kích thước file CSS** | Phình to vô hạn theo quy mô dự án | Nặng nề do chứa nhiều CSS/JS dựng sẵn | Siêu nhẹ (~10KB) nhờ cơ chế quét code loại bỏ CSS thừa |
| **Tính độc bản (Customizability)** | Tuyệt đối, nhưng tốn công viết từ đầu | Khó tùy biến, dễ tạo ra các website trông giống hệt nhau | Cực kỳ linh hoạt, dễ dàng thiết kế giao diện cao cấp riêng biệt |
| **Quy trình phát triển** | Chậm, phải đặt tên class và quản lý file CSS | Nhanh, sử dụng các component có sẵn | Cực nhanh, thiết kế trực tiếp ngay trong mã HTML/React |
| **Context Switching** | Rất nhiều (phải mở file JS/HTML song song file CSS) | Ít (chủ yếu dùng class có sẵn) | Gần như bằng không |

---

## 3. Các khái niệm cốt lõi của Tailwind áp dụng trong VivyChat

Hãy cùng phân tích cách chúng ta sử dụng Tailwind CSS để tối ưu hóa hiệu năng và giao diện Glassmorphism trong các component chat:

### A. Tùy biến Giá trị Bất kỳ (Arbitrary Values)
Nếu các class có sẵn của Tailwind (như `rounded-lg`, `bg-red-500`) không đáp ứng được kích thước chính xác, Tailwind cho phép bạn viết các giá trị tùy ý bên trong dấu ngoặc vuông `[...]`:
*   **Trong [MessageList.tsx](/frontend/src/components/chat/MessageList.tsx):**
    ```tsx
    // Bo tròn góc đặc biệt cho bóng bong bóng chat
    className="rounded-[16px_16px_2px_16px]"
    ```
    Tailwind sẽ tự động biên dịch class trên thành: `border-radius: 16px 16px 2px 16px;`.
*   **Trong [Sidebar.tsx](/frontend/src/components/chat/Sidebar.tsx):**
    ```tsx
    // Sử dụng biến CSS động cấu hình hệ màu
    className="border-[var(--bg-card-border)] bg-white/[0.02]"
    ```
    *   `border-[var(--bg-card-border)]` kết nối trực tiếp với biến màu CSS trong hệ thống design token.
    *   `bg-white/[0.02]` tạo màu nền trắng với độ mờ đục chỉ 2% (`opacity: 0.02`).

### B. Trạng thái Tương tác (Hover, Focus, Active...)
Bạn có thể áp dụng style khi người dùng di chuột hoặc chọn ô nhập liệu bằng cách thêm tiền tố (`hover:`, `focus:`) trước class:
*   **Trong [MessageInput.tsx](/frontend/src/components/chat/MessageInput.tsx):**
    ```tsx
    // Mặc định màu chữ là text-muted, khi di chuột qua thì đổi sang màu trắng
    className="text-[var(--text-muted)] hover:text-white transition-all"
    
    // Khi click chọn ô input thì viền chuyển sang màu Cyan và có bóng mờ phát sáng
    className="focus:border-[var(--color-cyan)] focus:shadow-[0_0_0_2px_var(--color-cyan-glow)]"
    ```

### C. Thiết kế Thích ứng (Responsive Design - Mobile First)
Tailwind áp dụng nguyên tắc **Mobile-First** (thiết kế cho di động trước, sau đó mở rộng ra màn hình lớn bằng tiền tố `md:`, `lg:`):
*   **Trong [App.tsx](/frontend/src/App.tsx):**
    ```tsx
    // Trên điện thoại: cột này bị ẩn (hidden). Từ màn hình máy tính trở lên: hiển thị block (md:block)
    className={`${activeFriendId ? 'hidden md:block' : 'block'} w-full md:w-80`}
    ```
    Cách viết này giúp chúng ta điều hướng responsive cực kỳ mượt mà mà không cần viết các câu lệnh `@media (min-width: 768px)` thủ công phức tạp.

### D. Ghi đè bắt buộc (The Important Flag `!`)
Khi cần ghi đè tuyệt đối các thuộc tính đã được định nghĩa sẵn trong các tệp CSS khác, ta thêm dấu chấm than `!` vào trước class Tailwind:
*   **Trong [App.tsx](/frontend/src/App.tsx):**
    ```tsx
    // Lớp .app-container mặc định có max-width là 480px trong index.css. 
    // Khi ở thành công, ta dùng class !max-w-[960px] để ghi đè bắt buộc lên 960px.
    className={`app-container ${currentPage === 'success' ? '!max-w-[960px]' : ''}`}
    ```

---


Vì số lượng class là vô cùng lớn, hệ thống của Tailwind được xây dựng theo các quy tắc đặt tên rất logic. Dưới đây là các nhóm class cốt lõi và phổ biến nhất để bạn dễ dàng nắm bắt:

#### 1. Khoảng cách (Spacing: Margin & Padding)

Quy tắc: `[Loại]-[Hướng]-[Kích thước]`

* **Loại:** `m` (margin - căn lề ngoài), `p` (padding - căn lề trong).
* **Hướng:** `t` (top), `b` (bottom), `l` (left), `r` (right), `x` (ngang: trái + phải), `y` (dọc: trên + dưới), hoặc để trống (tất cả các hướng).
* **Ví dụ:**
* `m-4`: margin 1rem (16px) ở cả 4 hướng.
* `mt-2`: margin-top 0.5rem (8px).
* `px-4`: padding left và right 1rem.
* `py-2`: padding top và bottom 0.5rem.



#### 2. Kích thước (Sizing: Width & Height)

Quy tắc: `w-[Kích thước]` và `h-[Kích thước]`

* **Ví dụ:**
* `w-full`: chiều rộng 100% (`width: 100%`).
* `w-1/2`: chiều rộng 50%.
* `w-screen`: chiều rộng bằng toàn bộ màn hình (`100vw`).
* `h-64`: chiều cao cố định (16rem/256px).
* `h-screen`: chiều cao bằng toàn bộ màn hình (`100vh`).



#### 3. Bố cục (Layout)

* **Hiển thị (Display):** `block`, `inline-block`, `inline`, `hidden` (ẩn phần tử).
* **Flexbox:**
* `flex`: Biến phần tử thành flex container.
* `flex-col`: Sắp xếp các phần tử con theo chiều dọc.
* `justify-center`, `justify-between`: Căn chỉnh trục chính (thường là chiều ngang).
* `items-center`, `items-start`: Căn chỉnh trục chéo (thường là chiều dọc).


* **Grid:**
* `grid`: Biến phần tử thành grid container.
* `grid-cols-1`, `grid-cols-3`: Chia làm 1 hoặc 3 cột bằng nhau.
* `gap-4`: Khoảng cách giữa các hàng và cột.



#### 4. Kiểu chữ (Typography)

* **Kích thước & Độ đậm:**
* `text-sm`, `text-base` (mặc định), `text-lg`, `text-2xl`: Kích thước chữ.
* `font-light`, `font-normal`, `font-semibold`, `font-bold`: Độ đậm/nhạt của chữ.


* **Căn chỉnh:** `text-left`, `text-center`, `text-right`, `text-justify`.
* **Màu sắc:** `text-red-500`, `text-blue-700`, `text-white`.

#### 5. Màu nền & Viền (Background & Borders)

* **Màu nền:** `bg-gray-100`, `bg-black`, `bg-transparent`.
* **Viền (Borders):**
* `border`: Thêm viền mỏng 1px.
* `border-2`, `border-t-4`: Độ dày viền (viền tất cả hoặc viền trên).
* `border-gray-300`: Màu viền.


* **Bo góc (Border Radius):** `rounded`, `rounded-md`, `rounded-lg`, `rounded-full` (bo tròn hoàn toàn, thường dùng cho avatar).
* **Đổ bóng (Shadow):** `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`.

#### 6. Trạng thái & Responsive (Modifiers)

Tailwind cực kỳ mạnh mẽ nhờ các tiền tố (prefix) kết hợp với dấu hai chấm `:` để xử lý trạng thái hoặc kích thước màn hình.

* **Tương tác:**
* `hover:bg-blue-600`: Đổi màu nền khi di chuột qua.
* `focus:ring-2`: Hiện vòng outline khi focus (nhấp vào input).
* `active:scale-95`: Bấm vào thì nút hơi co lại.


* **Responsive (Kích thước màn hình):**
* Mặc định Tailwind là *Mobile-first* (code không có tiền tố sẽ áp dụng cho điện thoại).
* `md:flex`: Chỉ áp dụng `flex` trên màn hình tablet trở lên.
* `lg:w-1/3`: Chỉ chiếm 1/3 chiều rộng trên màn hình desktop.



---

## 4. Tại sao Tailwind CSS lại giúp tăng hiệu năng render?

Như đã phân tích ở phần cảnh báo của dự án, việc viết CSS Inline:
```tsx
style={{ display: 'flex', gap: '8px', padding: '12px' }}
```
Sẽ làm trình duyệt phải tính toán và tạo ra một đối tượng style mới trên bộ nhớ RAM ở **mỗi lần component render**.

Khi chuyển sang Tailwind:
```tsx
className="flex gap-2 p-3"
```
Trình duyệt chỉ việc gán các chuỗi class tĩnh. Đồng thời, trình biên dịch **JIT (Just-In-Time)** của Tailwind sẽ quét toàn bộ các file nguồn `.tsx` của chúng ta, lọc ra các class được sử dụng và tạo ra một tệp CSS tĩnh duy nhất cực kỳ nhỏ gọn. Tất cả các class không được sử dụng sẽ bị loại bỏ hoàn toàn (Tree-shaking) khi build production.

---

## 📚 Tóm tắt bài học

*   **Utility-First** giúp viết CSS cực nhanh, trực quan ngay trên file JSX/TSX mà không cần chuyển đổi file liên tục.
*   Sử dụng **Ngoặc vuông `[...]`** để tùy biến giá trị CSS bất kỳ như căn lề, bo góc hay màu sắc tùy chọn.
*   Hỗ trợ đầy đủ các tính năng nâng cao như **Responsive (`md:`)**, **Hover (`hover:`)**, và **Ghi đè (`!`)**.
*   **Tối ưu hiệu năng vượt trội** so với CSS Inline bằng cách tránh tạo các đối tượng JavaScript dư thừa khi re-render.
