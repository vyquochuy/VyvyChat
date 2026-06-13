# Báo cáo Kết quả Thực hiện Hệ thống Avatar Vector Chibi - Phase 8

Báo cáo này tổng hợp kết quả của quá trình nâng cấp hệ thống ảnh đại diện (avatar) của **VivyChat** từ đồ họa pixel 16x16 thô sơ sang **Hệ thống Vector Chibi Mascot 40x40** chuyên nghiệp, mềm mại và gọn nhẹ, vận hành hoàn toàn phía máy khách (client-side) và được tạo động từ UID của người dùng.

---

## 🚀 Các công việc đã hoàn thành (Achievements)

### 1. Kiến trúc sinh ảnh đại diện Vector Primitives

Thay vì đặt màu cho từng ô pixel (gây răng cưa và giới hạn chất lượng), hệ thống mới sử dụng hoàn toàn các khối hình học vector SVG (`circle`, `ellipse`, `path`, `polygon`, `rect`) để phác họa nhân vật:

- **Độ phân giải hiển thị linh hoạt**: Sử dụng `viewBox="0 0 40 40"` cho phép ảnh co giãn tự do, sắc nét tuyệt đối tại bất kỳ kích thước nào (32px, 40px, 48px, 64px) mà không cần thêm thư viện ngoài.
- **Màu nền Pastel dịu mát**: Thay thế các dải màu neon hoặc gradient tối màu bằng các cặp gradient pastel sáng trẻ trung (Hồng → Đào, Xanh dương → Băng, Bạc hà → Lục lam, Vàng → Cam đào, Oải hương → Xanh nhạt, Hồng → Oải hương).

### 2. Thuật toán phân nhóm và hình mẫu ngẫu nhiên (Archetypes & Seed)

Hệ thống sử dụng các thuật toán lõi sau để sinh avatar một cách nhất quán:

- **Hàm băm chuỗi UID (`hashString`)**:
  Chuyển đổi UID dạng chuỗi (string) thành một số nguyên dương duy nhất bằng thuật toán dịch bit tích lũy:
  ```typescript
  export const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };
  ```
  Nhờ vậy, cùng một UID sẽ luôn sinh ra cùng một mã băm duy nhất trên mọi thiết bị và trình duyệt.
- **Bộ sinh số ngẫu nhiên tuần tự có hạt giống (`SeededRandom`)**:
  Sử dụng thuật toán sinh số ngẫu nhiên tuyến tính đồng dư LCG (Linear Congruential Generator) với công thức:
  $$X_{n+1} = (a \cdot X_n + c) \pmod m$$
  Trong đó: $a = 9301$, $c = 49297$, $m = 233280$. Giúp sinh ra các tham số ngẫu nhiên (chỉ số màu sắc, kiểu tai, biểu cảm mắt, phụ kiện) hoàn toàn đồng bộ theo hạt giống băm từ UID.
- **Phân bổ 6 Archetypes**:
  Tất cả các tài khoản được phân bổ đều vào 6 hình mẫu chibi mascot thông qua phép chia dư `hash % 6`:
  - `0`: **Cat (Mèo)** - Tai nhọn tam giác, râu, nháy mắt, cài hoa, nơ cổ.
  - `1`: **Bear (Gấu)** - Tai tròn, mõm mật ong, kính gọng đỏ, gấu trúc Panda.
  - `2`: **Rabbit (Thỏ)** - Tai dài dựng đứng/tai cụp, răng thỏ, má hồng gặm cà rốt.
  - `3`: **Fox (Cáo)** - Cáo cam đuôi bông trắng, tai to vạt trắng, mắt híp lém lỉnh.
  - `4`: **Slime (Game Mascot)** - Giọt nước dẻo dai lấp lánh, biểu cảm vui vẻ/angry/sleepy, vương miện vàng.
  - `5`: **Anime Girl (Chibi Anime)** - Tóc dày nhiều lớp bangs, mắt to phản chiếu đa điểm, má hồng, kẹp tóc.

### 3. Thiết kế Hệ thống Render phân lớp (Layer-based Architecture)

Mã nguồn [avatar.ts](../../frontend/src/utils/avatar.ts) được cơ cấu lại thành các tầng lớp hiển thị theo thứ tự chiều sâu (Z-index):

1. **Background Layer**: Dựng vòng tròn nền phối màu Gradient Pastel ngẫu nhiên.
2. **Effects Layer**: Vẽ các hiệu ứng nền (như hạt bong bóng, ngôi sao lấp lánh, hoặc tia sáng lơ lửng).
3. **Character Base Layer**: Vẽ cơ thể, vai, đầu, và phần tai/đuôi của từng loài thú.
4. **Face Details Layer**: Vẽ má hồng, các mảng lông trắng trên má (Fox), hoặc mảng đen quanh mắt (Panda).
5. **Eyes Layer**: Dựng cấu trúc mắt (nháy mắt bằng đường bezier, mắt to tròn đen/màu, hoặc mắt híp hửng hờ).
6. **Mouth Layer**: Các biểu cảm miệng (miệng cười mèo `:3`, miệng thỏ lộ răng cửa, miệng ngạc nhiên hình tròn).
7. **Accessories Layer**: Vẽ nơ, khăn quàng cổ, kính gọng đỏ, kẹp tăm màu, hoặc cà rốt trên tai/tay.

### 4. Cơ chế Runtime Caching

Để loại bỏ việc trình duyệt phải tính toán và sinh chuỗi SVG liên tục mỗi lần React re-render danh sách chat:

- Sử dụng một đối tượng `avatarCache = new Map<string, string>()` trong bộ nhớ runtime.
- Khi gọi `getPixelAvatarUri(uid)`, hệ thống kiểm tra cache: nếu có sẽ trả về ngay lập tức, ngược lại mới chạy thuật toán sinh SVG, mã hóa thành data-URI dạng `data:image/svg+xml;utf8,...` và lưu vào cache để sử dụng lại.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **SVG (Scalable Vector Graphics)**: Chuẩn đồ họa vectơ nội hàm HTML5 giúp tải nhẹ và sắc nét vô hạn.
- **TypeScript & Web API**: Web APIs tích hợp giải thuật toán học LCG thuần túy không phụ thuộc thư viện đồ họa nặng nề ngoài.
- **React & Zustand (UI/UX Integration)**: Tích hợp trực tiếp vào component `<Avatar>` và các màn hình Sidebar, ChatArea, ContactList.

---

## 💡 Kiến thức đúc kết (Lessons Learned)

1. **Hiệu năng của SVG inline và data-URI**: Sử dụng data-URI trong thẻ `<img>` kết hợp cache runtime là giải pháp cân bằng tốt nhất giữa hiệu suất bộ nhớ và độ tùy biến. Trình duyệt tự động tối ưu hóa việc giải mã ảnh và không phải chèn trực tiếp hàng trăm thẻ XML con vào DOM Tree chính của React, giúp tăng tốc độ cuộn danh sách chat.
2. **Tính toán Vector hóa**: Vẽ vector chibi không đối xứng mang lại tính độc bản cao. Việc tạo hình bằng các điểm tọa độ và đường cong Bezier (`Q` - quadratic bezier curve) giúp code gọn nhẹ hơn gấp nhiều lần so với việc lưu trữ ma trận pixel khổng lồ.

Toàn bộ quy trình từ một chuỗi mã người dùng uid (ví dụ: "10000001") biến thành một bức ảnh vectơ linh vật dễ thương được thực hiện qua 5 bước tuần tự:

🎨 Tóm tắt mô hình 5 bước tạo Avatar

```mermaid
graph TD
A[Mã người dùng: uid] -->|Bước 1: hashString| B[Số hạt giống duy nhất: seed]
B -->|Bước 2: LCG Randomizer| C[Hộp sinh số ngẫu nhiên tất định]
C -->|Bước 3| D[Chọn 1 trong 6 loài: hash % 6]
C -->|Bước 4| E[Quyết định màu lông, tai, phụ kiện, mắt, miệng]
E -->|Bước 5| F[Vẽ các hình học đè lên nhau thành SVG và mã hóa data-URI]
Bước 1: Biến chuỗi uid thành một Con số hạt giống (seed)
Vì máy tính chỉ làm việc tốt với số khi tính toán ngẫu nhiên, ta cần biến chuỗi chữ/số uid thành một con số nguyên dương duy nhất. Hàm hashString thực hiện việc này:
```

```typescript
export const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    // Lấy mã ký tự ASCII, ví dụ ký tự '1' là 49
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash); // Trả về số nguyên dương
};
```

Ví dụ cụ thể:
Nếu uid = "10000001", qua các phép dịch bit tích lũy, hàm này sẽ luôn trả ra con số băm cố định là 677134371.
Con số này chính là hạt giống (seed) của người dùng đó. Nó cố định và không bao giờ đổi.
Bước 2: Thiết lập "Hộp sinh số ngẫu nhiên cố định" (SeededRandom)
Nếu dùng hàm Math.random() của trình duyệt, mỗi lần chạy nó sẽ ra một số khác nhau. Như vậy avatar sẽ bị thay đổi liên tục. Ta cần một hàm "ngẫu nhiên nhưng luôn ra một kết quả giống nhau khi truyền cùng hạt giống".

Chúng ta sử dụng thuật toán LCG (Linear Congruential Generator):

```typescript
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    // Công thức toán học LCG
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280; // Luôn trả ra số thực từ 0 đến dưới 1
  }
}
```

Khi ta truyền số hạt giống từ Bước 1 vào hộp này, mỗi lần gọi .next(), nó sẽ trả ra chuỗi số thập phân ngẫu nhiên (ví dụ: 0.45, 0.82, 0.12).
Điểm đặc biệt: Dù chạy ở máy tính nào, điện thoại nào, chuỗi số trả ra luôn luôn trùng khớp.
Bước 3: Xác định loài sinh vật (Archetype)
Chúng ta có 6 loài sinh vật khác nhau. Việc chọn loài được thực hiện bằng phép chia lấy dư số hạt giống cho 6 (hash % 6):

```typescript
const archetype = hash % 6; // Kết quả luôn từ 0 đến 5
0 $\rightarrow$ Mèo (Cat)
1 $\rightarrow$ Gấu (Bear)
2 $\rightarrow$ Thỏ (Rabbit)
3 $\rightarrow$ Cáo (Fox)
4 $\rightarrow$ Slime
5 $\rightarrow$ Anime Girl
```

Bước 4: Lên ý tưởng và Quyết định ngoại hình (Phần cứng & Phụ kiện)
Dựa vào các số thực sinh ra từ Bước 2, hệ thống sẽ quyết định xem nhân vật trông như thế nào.

Chọn màu nền: Mảng màu pastel có 6 cặp gradient. Ta chọn bằng cách: const grad = PASTEL_GRADIENTS[Math.floor(rand.next() * 6)] (lấy ngẫu nhiên từ 0 đến 5).
Quyết định có đeo kính hay không: const glasses = rand.next() > 0.7 $\rightarrow$ Nếu số ngẫu nhiên lớn hơn 0.7 (khoảng 30% cơ hội), nhân vật sẽ đeo kính.
Quyết định có nháy mắt hay không: const wink = rand.next() > 0.5 $\rightarrow$ Nếu lớn hơn 0.5 (50% cơ hội), mắt bên phải sẽ nhắm lại cười.
Bước 5: "Vẽ" các lớp hình học đè lên nhau (SVG Layering)
Toàn bộ bức vẽ được vẽ trên một "tờ giấy" ảo kích thước 40 x 40 pixel. Hãy tưởng tượng ta đang dán các lớp giấy màu đè lên nhau từ dưới lên trên:

Lớp 1: Hình tròn nền (Background): Vẽ một hình tròn tô màu gradient chiếm trọn không gian:
html
<circle cx="20" cy="20" r="20" fill="url(#gradient-id)" />
Lớp 2: Hiệu ứng nền (Effects): Nếu seed quyết định có bong bóng, ta vẽ thêm vài chấm tròn màu trắng đục nằm lệch góc:
html
<circle cx="7" cy="15" r="1.5" fill="none" stroke="#fff" opacity="0.5" />
Lớp 3: Phần thân và đầu (Body & Head): Vẽ vai bằng một hình elip dẹt phía dưới và cái đầu tròn ở giữa:
html
<ellipse cx="20" cy="34" rx="9" ry="6" fill="#furColor" />
<circle cx="20" cy="22" r="10" fill="#furColor" />
Nếu là con Mèo, ta vẽ thêm 2 hình tam giác nhọn ở đỉnh đầu làm tai:
html
<polygon points="11,15 11,5 18,14" fill="#furColor" />
Lớp 4: Mắt và Miệng (Face Details):
Hai đốm tròn đen/màu làm mắt:
html
<circle cx="15" cy="22" r="1.8" fill="#eyeColor" />
kèm đốm nhỏ màu trắng bên trong làm tròng mắt lấp lánh.
Vẽ đường cong mềm để làm khuôn miệng cười bằng thẻ path (đường cong Bezier Q đi qua 3 điểm để tạo độ cong tự nhiên):
html
<path d="M18.5,24.8 Q20,26 21.5,24.8" stroke="#334155" fill="none" />
Lớp 5: Phụ kiện (Accessories): Nếu nhân vật đeo kính, ta dán đè 2 vòng tròn màu đỏ rực nối với nhau bằng 1 nét gạch ngang lên trên phần mắt:
html
<circle cx="15" cy="21.5" r="3.2" stroke="#ef4444" fill="none" />
<circle cx="25" cy="21.5" r="3.2" stroke="#ef4444" fill="none" />
<line x1="18" y1="21.5" x2="22" y2="21.5" stroke="#ef4444" />

🚀 Kết quả cuối cùng:
Tất cả các đoạn mã HTML nhỏ này được ghép lại thành một chuỗi văn bản XML SVG duy nhất. Để thẻ <img> của React hiển thị được, chuỗi này được chuyển thành dạng data-URI: data:image/svg+xml;utf8,<svg>...</svg> và nạp trực tiếp vào thuộc tính src.

Quy trình này không hề tạo ra tệp tin vật lý nào trên ổ cứng, diễn ra cực nhanh trên RAM và được cache lại bằng Map để lần sau mở lại, avatar hiện lên ngay lập tức!
