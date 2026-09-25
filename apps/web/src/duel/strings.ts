/**
 * UI strings for the duel screen, Vietnamese, in one module so i18n (task 2.12) can replace it with locale files
 * without touching the scenes. Card text comes from card data, not from here.
 */
export const strings = {
  menuTitle: 'YUGI H5 RECREATE',
  playVsAi: 'Đấu với AI',
  starting: 'Đang tạo trận…',
  startFailed: 'Không tạo được trận (API chưa chạy?)',
  back: '< Menu',

  nextPhase: 'Phase tiếp theo',
  endTurn: 'Kết thúc lượt',
  surrender: 'Đầu hàng',
  surrenderConfirm: 'Xác nhận đầu hàng?',

  you: 'Bạn',
  opponent: 'Đối thủ',
  turn: 'Lượt',
  phase: {
    Draw: 'Draw',
    Standby: 'Standby',
    Main1: 'Main 1',
    Battle: 'Battle',
    Main2: 'Main 2',
    End: 'End',
  },
  yourTurn: 'Lượt của bạn',
  opponentTurn: 'Lượt của đối thủ',

  thinking: 'AI đang suy nghĩ…',
  sending: 'Đang gửi…',

  win: 'BẠN THẮNG',
  lose: 'BẠN THUA',
  draw: 'HÒA',
  backToMenu: 'Về menu',

  discardPrompt: 'Tay quá giới hạn: bấm 1 lá để bỏ xuống mộ',
  discardNeedsDrag: 'Cần bỏ nhiều lá: chọn các lá rồi bấm Xác nhận',

  // Interaction (task 2.8)
  summonOption: 'Triệu hồi',
  setOption: 'Úp (Set)',
  toAttackOption: 'Đổi sang Tấn công',
  toDefenseOption: 'Đổi sang Phòng thủ',
  confirm: 'Xác nhận',
  cancel: 'Hủy',
  pickTributeHint: 'Chọn quái để hiến tế rồi bấm Xác nhận',
  pickDiscardHint: 'Chọn các lá để bỏ rồi bấm Xác nhận',
  toastNoZone: 'Không thể đặt lá này vào đây.',
  toastCardLocked: 'Lá này chưa thể dùng lúc này.',
  toastBadTarget: 'Không thể tấn công mục tiêu này.',
  toastNotAllowed: 'Hành động này hiện không hợp lệ.',
  toastBusy: 'Đang xử lý, chờ một chút…',
  sendPreview: 'sẽ gửi:',
  promptOther: 'Đang chờ trả lời prompt',

  detailEmpty: 'Rê chuột / bấm vào một lá để xem chi tiết',
  detailHidden: 'Lá úp / lá ẩn',
  logTitle: 'Nhật ký',
  deck: 'Deck',
  graveyard: 'Mộ',
  extraDeck: 'Extra',
  field: 'Field',
} as const;
