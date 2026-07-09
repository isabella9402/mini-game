# CREDITS — 나비의 옥상 (그래픽 에셋)

Trò chơi `나비의 옥상.html` dùng một số ảnh 3D/voxel render cho phần đồ hoạ.
Các ảnh gốc nằm trong thư mục **`3D Resource/`** của repo (vốn thuộc dự án game
"K-판타지: 꼬마 도깨비의 모험"). Ảnh đã được **cắt viền trong suốt (alpha-trim)**
và đổi tên gọn, copy sang thư mục **`assets/`**. File gốc trong `3D Resource/`
KHÔNG bị sửa.

> ⚠️ **LICENSE — CẦN KIỂM TRA:** Mình không rõ nguồn/giấy phép gốc của các ảnh này.
> Nếu đây là asset do bạn/team tự tạo thì bỏ qua cảnh báo. Nếu tải từ nơi khác,
> hãy rà lại quyền sử dụng trước khi phát hành công khai. Tất cả mục dưới đều
> đánh dấu **"license 확인 필요"**.

## Ảnh đã dùng (assets/ ← gốc → phần tử game)

| assets/ | File gốc (3D Resource/) | Gắn vào phần tử | License |
|---|---|---|---|
| `cat.png` | `3D_main character.jpg` (PNG RGBA) | 🐱 Mèo Nabi (player + mascot màn ready). Đã cắt bỏ bệ đá dưới chân | ⚠️ 확인 필요 |
| `fish.png` | `3D_붕어빵.jpg` | 🥮 Item 붕어빵 (cộng điểm) | ⚠️ 확인 필요 |
| `churu.png` | `3D_소떡.jpg` | ⚡ Item 츄르/Fever (xiên 소떡소떡) | ⚠️ 확인 필요 |
| `building1.png` | `3D_gama01.jpg` | 🏙️ Nhà gần (tone 0) — diorama 가마 | ⚠️ 확인 필요 |
| `building2.png` | `3D_gama02.jpg` | 🏙️ Nhà gần (tone 1) | ⚠️ 확인 필요 |
| `building3.png` | `3D_gama03.jpg` | 🏙️ Nhà gần (tone 2) | ⚠️ 확인 필요 |
| `building4.png` | `3D_gama04.jpg` | 🏙️ Nhà gần (tone 3) | ⚠️ 확인 필요 |
| `bg_far.png` | `3D_map.png` (JPEG 1376×768) | 🌆 Nền panorama làng (parallax, tiled ngang) | ⚠️ 확인 필요 |
| `tree_neon.png` | `3D_tree01.jpg` | 🌳 Cây trang trí mùa 네온 (parallax) | ⚠️ 확인 필요 |
| `tree_autumn.png` | `3D_tree02.jpg` | 🍁 Cây trang trí mùa 단풍 | ⚠️ 확인 필요 |
| `tree_blossom.png` | `3D_tree04.jpg` | 🌸 Cây trang trí mùa 벚꽃 / 겨울 | ⚠️ 확인 필요 |
| `rock1.png` | `3D_rock01.jpg` | 🪨 Đá trang trí ven đường | ⚠️ 확인 필요 |
| `rock2.png` | `3D_rock02.jpg` | 🪨 Đá trang trí ven đường | ⚠️ 확인 필요 |
| `turtle1.png` | `3D_turtle01.jpg` | 🐢 Linh vật trang trí ven đường | ⚠️ 확인 필요 |
| `eagle.png` | `3D_eagle.jpg` | 🦅 Đại bàng trôi trên trời (parallax) | ⚠️ 확인 필요 |
| `ghost1.png` | `3D_ghost.jpg` | 👻 도깨비 trôi trên trời (parallax) | ⚠️ 확인 필요 |

## Phần GIỮ pixel-art tự vẽ (không có ảnh phù hợp — fallback)

- **4 loại đèn lồng** (초롱 normal / 반딧불 / 용수철 / 비눗방울) — không có ảnh đèn
  lồng đơn trong resources → giữ nguyên sprite pixel-art (`SPR_LAN`…).
- **Trampoline** (đệm nảy) — không có ảnh → pixel-art.
- **Hạt thời tiết 4 mùa** (hoa/lá/tuyết/đom đóm) — không có ảnh → pixel-art.
- **Đường phố + xe + sao + trăng + HUD** — không có ảnh → pixel-art.

> Cơ chế fallback: nếu một ảnh nạp lỗi (vd mở bằng `file://`), phần tử đó **tự động
> quay về pixel-art**, game vẫn chạy — chỉ khác diện mạo.

## Ảnh CÓ trong resources nhưng CHƯA dùng

`3D_charm.jpg`, `3D_charm02.jpg`, `3D_chili.jpg`, `3D_gama` (bản dư), `3D_ghost02.jpg`,
`3D_ghost03.jpg`, `3D_tree03.jpg` (nền trắng, không trong suốt), `3D_turtle02.jpg`,
`3D_rock*` (bản dư), `3D_map01.png`, `3D_background.jpg`.

## Không đổi (theo yêu cầu)

- **Âm thanh:** Web Audio `sfx()` — giữ nguyên, không thêm file.
- **Font:** Galmuri (OFL) qua jsDelivr CDN — giữ nguyên.
- **Cơ chế / điểm / mùa:** giữ nguyên hoàn toàn.
