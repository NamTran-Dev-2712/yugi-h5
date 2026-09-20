# Card Art & Asset Pipeline

Nguyên tắc: **khung bài, chữ, sao, ATK/DEF, thuộc tính, icon loại bài vẽ bằng code**. Art mỗi lá = 1 ảnh vuông thả vào slot.
Card thiếu art → placeholder hiện tên card. Bạn thả file, **không sửa code**.

## Spec art lá bài

| Mục                | Giá trị đề xuất                                                                       |
| ------------------ | ------------------------------------------------------------------------------------- |
| Tỉ lệ / kích thước | Vuông **512×512** px (tối thiểu 256×256)                                              |
| Định dạng          | WebP (chấp nhận PNG/JPG; script chuyển sang WebP)                                     |
| Tên file           | `<cardId>.webp` (ví dụ `wandering-squire.webp`); `cardId` = `id` trong CardDefinition |
| Thư mục            | `assets/card-art/`                                                                    |
| Dung lượng         | ≤ 150 KB/ảnh sau optimize (cảnh báo > 250 KB)                                         |
| Safe area          | Nội dung chính trong vòng tròn/khung 80% ở giữa (khung bài che 10% mép)               |
| Màu                | sRGB, không alpha (nền đặc)                                                           |

## Thư mục asset (đề xuất)

```
assets/
  card-art/        <cardId>.webp                  # art lá bài
  card-art-src/    ảnh gốc chưa xử lý (bạn thả ở đây được)
  backgrounds/     bg-duel-*.webp, bg-menu.webp   # 1920×1080 hoặc 1280×720
  ui/              icon-*.png (64×64), btn-*.png
  vfx/             <name>.png (spritesheet) + <name>.json (atlas)
  audio/sfx/       sfx-<event>.ogg   audio/bgm/  bgm-<scene>.ogg
  generated/       thumbnails, atlas, manifest (tự sinh, không sửa tay)
```

Vị trí: `assets/` ở gốc repo (không nằm trong `apps/web/public/` để tách khỏi code). Vite phục vụ qua alias/copy khi build.
`.gitignore`: `assets/generated/` luôn ignore; `assets/card-art*/` **ignore theo mặc định** (xem "Asset pack").

## Manifest & validate

| Script (đề xuất)       | Việc                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm assets:manifest` | Quét thư mục → sinh `card-art.manifest.json` (id → path, hash, size)                            |
| `pnpm assets:validate` | Báo: card thiếu art; file thừa không có card; sai kích thước/định dạng; quá dung lượng; tên sai |
| `pnpm assets:optimize` | Resize 512, chuyển WebP, sinh thumbnail (128 cho deck builder/hand) + texture atlas Phaser      |
| `pnpm assets:report`   | Xuất báo cáo Markdown cho bạn (bảng thiếu/thừa/lỗi)                                             |

Optimize dùng thư viện ảnh (đề xuất `sharp`, dev-only) — **cần bạn duyệt trước khi cài** (CLAUDE.md).

## Load ở runtime

- Lazy theo deck đang dùng: chỉ tải art của card trong deck + đối thủ; còn lại tải khi cần (Gallery/Deck Builder).
- Thumbnail cho Hand/Deck Builder; art full khi mở Card Detail.
- Thiếu file → placeholder code-drawn (tên card + màu theo loại). Không crash.
- Atlas gom thumbnail để giảm draw call.

## Asset pack tách rời code

- Bộ art nằm ngoài git (ignore) hoặc repo riêng; đường dẫn cấu hình qua `ASSET_PACK_DIR` (env), mặc định `./assets`.
- Đổi bộ art = đổi đường dẫn/thả thư mục khác; manifest sinh lại; code không đổi.
- Placeholder pack nhỏ mặc định commit được (art tự vẽ/CC0).

## Card Gallery (dev page)

Xem toàn bộ card với art thật/placeholder, lọc "thiếu art", xem effect dạng văn bản, xem theo batch/tag. Làm ở task 5.5.

## Cách làm việc với ảnh (dành cho bạn)

| Mục                 | Quy ước                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Batch nộp           | 10–20 lá/lần; thả vào `assets/card-art-src/`                                              |
| Tên file            | `<cardId>.<ext>`; danh sách id + yêu cầu ở `docs/assets/ASSET_REQUESTS.md`                |
| Checklist duyệt ảnh | Vuông? Đúng id? Safe area không mất chi tiết? Không có chữ/logo trong art? Dung lượng ổn? |
| Báo lỗi             | Ghi vào `ASSET_REQUESTS.md` cột "Ghi chú" hoặc nhắn id + vấn đề                           |
| Sau khi nộp         | AI chạy `assets:validate` + `assets:optimize`, gửi báo cáo + link Gallery                 |

## Pháp lý (ngắn)

Ảnh bản quyền bên thứ ba **chỉ dùng cá nhân**, không commit lên repo public, không deploy công khai. Ưu tiên art tự tạo/AI-generated
(kiểm tra điều khoản công cụ). Card mặc định là placeholder tự đặt tên.

## Asset khác (spec tóm tắt)

| Loại       | Spec                                               | Thư mục               | Tên                | Validate                       |
| ---------- | -------------------------------------------------- | --------------------- | ------------------ | ------------------------------ |
| Background | 1280×720 (hoặc 1920×1080), WebP, ≤ 500 KB          | `assets/backgrounds/` | `bg-<scene>.webp`  | Kích thước, dung lượng         |
| Icon UI    | PNG nền trong suốt, 64×64 (icon lớn 128)           | `assets/ui/`          | `icon-<name>.png`  | Kích thước, alpha              |
| VFX sheet  | PNG spritesheet + JSON atlas (Phaser); ≤ 2048×2048 | `assets/vfx/`         | `<name>.png/.json` | Atlas hợp lệ, frame khớp       |
| SFX        | OGG (mono, 44.1kHz), ≤ 100 KB, < 3s                | `assets/audio/sfx/`   | `sfx-<event>.ogg`  | Thiếu sfx theo danh sách event |
| BGM        | OGG loop được, ≤ 2 MB/bài                          | `assets/audio/bgm/`   | `bgm-<scene>.ogg`  | Loop point, dung lượng         |

Danh sách SFX/BGM cần: `animation-plan.md`. Yêu cầu chi tiết từng đợt: `docs/assets/ASSET_REQUESTS.md`.
