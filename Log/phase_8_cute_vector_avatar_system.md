# Báo cáo Nhật ký Phát triển: Hệ thống Avatar Chibi Vector - Phase 8

Tài liệu này ghi nhận chi tiết kỹ thuật của quá trình phát triển **Phase 8**, tập trung vào việc refactor thuật toán sinh ảnh đại diện (avatar) động phía client từ dạng pixel sang dạng vectơ lớp chibi mascot độ phân giải cao và các tối ưu trải nghiệm giao diện chat VivyChat.

---

## 📐 Giải thuật & Toán học trong Bộ sinh Avatar (Algorithm & Mathematics)

Hệ thống avatar hoạt động hoàn toàn phía máy khách, không phụ thuộc vào máy chủ hay ảnh tĩnh tải sẵn, sử dụng 100% các phép toán và phần tử hình học SVG để tạo hình. Dưới đây là các bước chi tiết trong luồng xử lý:

### Bước 1: Tính toán hạt giống nhất quán (Deterministic Hashing)
Để đảm bảo mỗi người dùng luôn có một avatar duy nhất không đổi giữa các thiết bị mà không cần lưu trữ tệp ảnh trên cơ sở dữ liệu:
1. Chuỗi định danh người dùng `uid` được đưa qua hàm `hashString`.
2. Hàm này lặp qua từng ký tự của chuỗi, lấy mã ASCII (`charCodeAt`) và thực hiện dịch chuyển bit tích lũy trái 5 bit (`hash << 5`), trừ đi chính giá trị cũ để phân bố đều dữ liệu băm trong không gian số 32-bit:
   $$\text{hash} = \text{hash} \times 33 + \text{charCodeAt}(i)$$
3. Kết quả được lấy trị tuyệt đối (`Math.abs`) để có một số nguyên dương làm hạt giống (seed).

### Bước 2: Sinh số ngẫu nhiên hạt giống tuần tự (LCG Randomizer)
Do hàm `Math.random()` của JavaScript không hỗ trợ truyền hạt giống (seed), chúng tôi tự phát triển lớp `SeededRandom` dựa trên thuật toán **Linear Congruential Generator (LCG)**:
$$X_{n+1} = (a \cdot X_n + c) \pmod m$$
Với các hằng số chuẩn của thư viện glibc:
* Hằng số nhân (Multiplier) $a = 9301$
* Hằng số cộng (Increment) $c = 49297$
* Hằng số chia dư (Modulus) $m = 233280$

Mỗi khi gọi `rand.next()`, LCG sẽ sinh ra một số thực ngẫu nhiên trong khoảng $[0, 1)$ hoàn toàn tất định. Cùng một hạt giống UID ban đầu sẽ luôn cho ra một chuỗi số thực giống hệt nhau, đại diện cho tập hợp các thuộc tính hình ảnh của nhân vật.

### Bước 3: Phân bổ hình mẫu (Archetype Selection)
Phép chia dư `hash % 6` được dùng để chọn ra 1 trong 6 loài sinh vật chibi mascot với phân bổ đồng đều ($16.67\%$ cho mỗi loài):
* `0`: **Cat (Mèo)** - Hình tai tam giác và râu.
* `1`: **Bear (Gấu)** - Tai tròn, mõm rộng, có hỗ trợ vẽ Panda bằng cách phủ thêm 2 đốm đen xoay nghiêng quanh mắt.
* `2`: **Rabbit (Thỏ)** - Tai thỏ dài dựng đứng hoặc cong rủ rủ, răng cửa thỏ đặc trưng.
* `3`: **Fox (Cáo)** - Cáo cam má trắng đuôi bông tuyết.
* `4`: **Slime** - Thiết kế mascot giọt nước cách điệu từ game nhập vai.
* `5`: **Anime Girl** - Phong cách chibi anime với mái tóc dày chia bangs và mắt quá khổ.

### Bước 4: Dựng hình Phân lớp (Layer Rendering)
Mỗi avatar được xuất ra dưới dạng một chuỗi mã nguồn XML SVG bao gói trong `viewBox="0 0 40 40"` và sắp xếp theo 7 lớp chiều sâu Z-index từ dưới lên trên:
1. **Lớp nền (Background)**:
   Màu sắc được chọn từ mảng gồm 6 dải Gradient pastel dịu mát. Một thẻ `<circle cx="20" cy="20" r="20">` được vẽ và tô màu bằng dải tuyến tính `<linearGradient>` xoay chéo $45^\circ$.
2. **Lớp hiệu ứng nền (Effects)**:
   Tùy thuộc vào seed, hệ thống vẽ thêm bong bóng nước mờ (`circle` viền trắng) hoặc bụi sao lấp lánh (vẽ bằng thẻ `path` mô tả ngôi sao 4 cánh) ở góc của hình tròn để tạo cảm giác lung linh.
3. **Lớp cơ thể và bộ phận chính (Character Base)**:
   Vẽ cơ thể (ellipse nằm dưới), đầu (circle lớn ở tâm), và các phần nhô ra ngoài tùy loài như tai tam giác (Cat), tai tròn (Bear), tai dài (Rabbit), hoặc đuôi xòe ở phía sau (Fox).
4. **Lớp đặc trưng khuôn mặt (Face Details)**:
   Má hồng (`ellipse` màu hồng đỏ với `opacity="0.4"` hoặc `0.6`), các đốm lông trắng làm má bầu bĩnh (Fox) hoặc đốm đen lớn quanh mắt (Panda).
5. **Lớp mắt (Eyes)**:
   * Trạng thái nháy mắt (Winking): Sử dụng thẻ `<path>` vẽ đường cong Bezier bậc hai `Q` hướng lên trên để mô tả mí mắt đang khép lại vui vẻ.
   * Trạng thái bình thường: Sử dụng thẻ `<circle>` hoặc `<ellipse>` quá khổ (đối với Anime Girl) màu ngẫu nhiên, kết hợp thêm 2 đốm tròn trắng nhỏ lệch góc để giả lập ánh sáng phản chiếu long lanh.
6. **Lớp miệng (Mouth)**:
   Các đường cong Bezier mô tả khuôn miệng chúm chím (miệng thỏ lộ răng, miệng cười mèo `:3` hoặc miệng ngạc nhiên hình tròn).
7. **Lớp phụ kiện ngoài (Accessories)**:
   Dựng hình các phụ kiện thời trang ngộ nghĩnh đặt đè lên nhân vật (như mắt kính tròn màu đỏ có cầu nối, khăn quàng cổ xếp nếp, nơ kẹp tóc, kẹp tăm màu pastel, hoặc vương miện của slime).

### Bước 5: Mã hóa data-URI & Runtime Memory Cache
Để tránh việc trình duyệt phải phân tích cú pháp chuỗi SVG và tính toán lại tọa độ mỗi khi danh sách chat bị cuộn hoặc cập nhật trạng thái:
1. Tạo một biến toàn cục `avatarCache = new Map<string, string>()`.
2. Khi giao diện yêu cầu avatar của một UID, hệ thống lấy URI từ cache.
3. Nếu chưa có trong cache, hệ thống chạy chuỗi thuật toán trên để dựng SVG thô, sau đó mã hóa URI thông qua:
   `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
4. Trình duyệt nhận data-URI này vào thuộc tính `src` của thẻ `<img>` và tự động tối ưu hóa việc hiển thị phần cứng (hardware acceleration) mà không phải can thiệp trực tiếp vào cây DOM chính.

---

## 🛠️ Danh sách các tệp tin đã tạo & thay đổi

1. **[NEW]** [docs/phase-records/phase-8_cute_vector_avatar_system.md](file:///c:/Game/Email-Verify/docs/phase-records/phase-8_cute_vector_avatar_system.md) - Tài liệu kỹ thuật chi tiết Phase 8.
2. **[NEW]** [Log/phase_8_cute_vector_avatar_system.md](file:///c:/Game/Email-Verify/Log/phase_8_cute_vector_avatar_system.md) - Nhật ký phát triển và giải thuật Phase 8.
3. **[MODIFY]** [frontend/src/utils/avatar.ts](file:///c:/Game/Email-Verify/frontend/src/utils/avatar.ts) - Refactor thuật toán sinh avatar vector 40x40.
4. **[MODIFY]** [Log/changeLog.md](file:///c:/Game/Email-Verify/Log/changeLog.md) - Cập nhật danh sách thay đổi dự án tổng quát.
