# assets/

Asset dùng chung (art, nền, icon, VFX, âm thanh). Spec, tên file, thư mục: `docs/plan/card-art-pipeline.md`.
Yêu cầu đợt này: `docs/assets/ASSET_REQUESTS.md`.

| Thư mục         | Nội dung                                             | Tên                |
| --------------- | ---------------------------------------------------- | ------------------ |
| `card-art/`     | Art lá bài đã xử lý (512×512 WebP)                   | `<cardId>.webp`    |
| `card-art-src/` | Ảnh gốc bạn thả vào                                  | `<cardId>.<ext>`   |
| `backgrounds/`  | Nền màn hình                                         | `bg-<scene>.webp`  |
| `ui/`           | Icon/nút                                             | `icon-<name>.png`  |
| `vfx/`          | Spritesheet + atlas                                  | `<name>.png/.json` |
| `audio/sfx/`    | SFX OGG                                              | `sfx-<event>.ogg`  |
| `audio/bgm/`    | BGM OGG loop                                         | `bgm-<scene>.ogg`  |
| `generated/`    | Tự sinh (manifest, thumbnail, atlas) — không sửa tay |                    |

Ảnh bản quyền bên thứ ba chỉ dùng cá nhân, không commit lên repo public.
