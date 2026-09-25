# Asset cho vertical slice (P2, Duel Scene)

Mọi texture dưới đây hiện là **placeholder sinh bằng code** (Phaser Graphics, `apps/web/src/scenes/placeholder-textures.ts`), khai báo ở
`apps/web/src/duel/asset-manifest.ts`. Scene chỉ dùng **key**; thay bằng ảnh thật = đổi entry manifest sang `source: 'file'` + nạp ở Boot,
không sửa scene. Không dùng art/tên lá của Konami (xem `card-art-pipeline.md`, `human-tasks.md`).

Kích thước tính theo khung logic 1280×720 (`theme.ts`); ảnh nên xuất gấp đôi (2×) để nét khi Scale.FIT phóng to.

| Key manifest         | Kích thước logic | Đề xuất file (2×)                   | Hiện tại                                          | Ghi chú                                                                       |
| -------------------- | ---------------- | ----------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `board-bg`           | 1280×720         | `ui/board-bg.webp` 2560×1440        | placeholder code (nền xanh + vạch giữa + 2 panel) | Cần [REF] ảnh Duel gốc để chốt bố cục                                         |
| `card-frame-monster` | 84×104           | `ui/card-frame-monster.png` 168×208 | placeholder code (viền vàng)                      | Khung, chữ/sao/ATK-DEF vẽ bằng code (Phaser Text) theo `card-art-pipeline.md` |
| `card-frame-spell`   | 84×104           | `ui/card-frame-spell.png` 168×208   | placeholder code (viền xanh lục)                  | như trên                                                                      |
| `card-frame-trap`    | 84×104           | `ui/card-frame-trap.png` 168×208    | placeholder code (viền tím)                       | như trên                                                                      |
| `card-back`          | 84×104           | `ui/card-back.png` 168×208          | placeholder code (nâu + vòng tròn)                | Dùng cho tay/lá úp của đối thủ, Deck                                          |
| `zone-slot`          | 84×104           | `ui/zone-slot.png` 168×208          | placeholder code (ô xanh bo góc)                  | Ô quái / Spell-Trap / Field / Extra / Mộ; 2 ô EX khóa (C1) là task sau        |

## Task 2.8 (kéo thả) — không thêm asset mới

Mũi tên tấn công, viền ô hợp lệ/mục tiêu/ứng viên tribute, lá "ma" khi kéo, menu chọn, thanh Xác nhận/Hủy và toast đều **vẽ bằng code** (Phaser Graphics/Text, màu ở `theme.ts`: `validZone`, `target`, `arrow`, `selected`, `menuBg`, `toastBg`), không có key mới trong manifest. Khi có ảnh Duel gốc `[REF]` mới cần chốt: mũi tên (sprite hoặc đường vẽ), viền highlight, nút Xác nhận/Hủy, khung toast.

## Chưa có trong slice (làm sau, cần người dùng cung cấp hoặc duyệt)

- Art từng lá: 1 ảnh vuông 512×512 `<cardId>.webp` (task 5.x); hiện lá chỉ có khung + vùng art xám.
- Nút hex 3 trạng thái (Công / Kết thúc / Thủ, C4 `[DECISION]`): hiện là 3 nút chữ; cần asset khi chốt kiểu.
- Icon Level/sao, thanh LP kiểu gốc, hiệu ứng (VFX), âm thanh: P5/P6.
- Font: dùng font hệ thống (`theme.fonts`); chọn font manga/classic khi chốt phong cách.
