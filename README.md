# mini-game

## 나비의 옥상 — cách chạy

Game (`나비의 옥상.html`) giờ nạp ảnh từ thư mục `assets/`. Khi mở trực tiếp bằng
`file://`, trình duyệt sẽ **chặn CORS** khi `drawImage` → ảnh không hiện (và game
tự fallback về pixel-art). Vì vậy hãy chạy qua một **local server**:

```bash
cd mini-game
python -m http.server 8000
# rồi mở: http://localhost:8000/나비의 옥상.html
```

(hoặc `npx serve`, `php -S localhost:8000`, Live Server của VS Code…)

- Không có mạng vẫn chơi được (font Galmuri từ CDN sẽ fallback sang monospace,
  ảnh lỗi sẽ fallback về pixel-art).
- Chi tiết ảnh & license: xem `CREDITS.md`.

## Cấu trúc
- `나비의 옥상.html` — game endless swinging (mèo Nabi).
- `assets/` — ảnh đã dùng (đã cắt viền + đổi tên).
- `3D Resource/` — ảnh gốc (không sửa).
- `index (5).html` — game khác (K-판타지 도깨비).
