/**
 * Server error codes -> one short Vietnamese sentence for a toast. The engine codes are the ones in
 * packages/game-engine/src/errors.ts (a test reads that file, so a new code without a sentence turns it red).
 * Unknown codes get a generic sentence that shows the code, so nothing is ever silently swallowed.
 */
export interface ErrorLike {
  readonly status?: number | undefined;
  readonly code?: string | undefined;
  readonly engineCode?: string | undefined;
}

const ENGINE: Record<string, string> = {
  NO_STATE: 'Trận đấu chưa sẵn sàng.',
  UNHANDLED_ACTION: 'Hành động này chưa được hỗ trợ.',
  INVALID_STARTING_LP: 'Điểm LP ban đầu không hợp lệ.',
  DUEL_ENDED: 'Trận đấu đã kết thúc.',
  SURRENDER_DISABLED: 'Chế độ này không cho đầu hàng.',
  NO_PENDING_PROMPT: 'Hiện không có yêu cầu nào cần trả lời.',
  PROMPT_MISMATCH: 'Câu trả lời không khớp với yêu cầu hiện tại.',
  INVALID_DISCARD: 'Chọn sai số lá cần bỏ.',
  UNKNOWN_PROMPT_KIND: 'Loại yêu cầu này chưa được hỗ trợ.',
  PENDING_PROMPT: 'Hãy trả lời yêu cầu đang chờ trước.',
  NOT_TURN_PLAYER: 'Chưa đến lượt của bạn.',
  WRONG_PHASE: 'Không thể làm việc này ở phase hiện tại.',
  NORMAL_SUMMON_USED: 'Bạn đã dùng lượt Triệu hồi/Úp trong lượt này.',
  INVALID_ZONE: 'Ô này không hợp lệ.',
  CARD_NOT_IN_HAND: 'Lá này không còn trên tay.',
  NO_CARD_RESOLVER: 'Máy chủ thiếu dữ liệu lá bài.',
  CARD_DEFINITION_NOT_FOUND: 'Không tìm thấy dữ liệu của lá này.',
  NOT_A_MONSTER: 'Đây không phải lá quái thú.',
  TRIBUTE_COUNT_MISMATCH: 'Số quái hiến tế chưa đúng.',
  INVALID_TRIBUTE: 'Quái hiến tế đã chọn không hợp lệ.',
  ZONE_OCCUPIED: 'Ô này đã có quái.',
  INVALID_POSITION: 'Tư thế này không hợp lệ.',
  CARD_NOT_ON_FIELD: 'Lá này không còn trên sân.',
  MONSTER_FACE_DOWN: 'Quái đang úp nên không làm được việc này.',
  SAME_POSITION: 'Quái đã ở tư thế đó rồi.',
  POSITION_ALREADY_CHANGED: 'Quái này đã đổi tư thế trong lượt này.',
  SUMMONED_THIS_TURN: 'Quái vừa được triệu hồi trong lượt này.',
  ATTACKED_THIS_TURN: 'Quái này đã tấn công trong lượt này.',
  FIRST_TURN_ATTACK_BANNED: 'Lượt đầu tiên không được tấn công.',
  ATTACKER_IN_DEFENSE_POSITION: 'Quái đang ở tư thế Phòng thủ nên không tấn công được.',
  JUST_SUMMONED_CANNOT_ATTACK: 'Quái vừa ra sân chưa thể tấn công.',
  MUST_TARGET_MONSTER: 'Đối thủ còn quái, hãy chọn một quái để tấn công.',
  INVALID_TARGET: 'Mục tiêu tấn công không hợp lệ.',
};

const API: Record<string, string> = {
  NOT_OWNER: 'Bạn không có quyền điều khiển trận này.',
  PLAYER_MISMATCH: 'Hành động không thuộc về người chơi này.',
  VALIDATION_FAILED: 'Dữ liệu gửi lên không hợp lệ.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn, hãy tải lại trang.',
  DUEL_NOT_FOUND: 'Không tìm thấy trận đấu.',
  FORBIDDEN_ACTION: 'Hành động này không được phép.',
  AI_LOOP_LIMIT: 'Máy chủ dừng lượt AI vì quá dài.',
  INTERNAL_ERROR: 'Máy chủ gặp lỗi, thử lại sau.',
  NETWORK_ERROR: 'Mất kết nối tới máy chủ.',
  INVALID_VIEWER: 'Không thể xem trận từ ghế này.',
  INVALID_CONFIG: 'Cấu hình trận không hợp lệ.',
  UNKNOWN_CARD: 'Trận có lá bài không tồn tại.',
};

const generic = (code: string): string => `Không thực hiện được (mã ${code}).`;

export function messageFor(err: ErrorLike): string {
  if (err.engineCode) return ENGINE[err.engineCode] ?? generic(err.engineCode);
  if (err.status === 0) return API['NETWORK_ERROR']!;
  if (err.status === 401) return API['UNAUTHORIZED']!;
  if (err.status === 429) return 'Gửi quá nhanh, thử lại sau giây lát.';
  if (err.code && API[err.code]) return API[err.code]!;
  return generic(err.code ?? 'UNKNOWN');
}
