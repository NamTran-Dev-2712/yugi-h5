import type { CardDetail } from './presenter';
import { strings } from './strings';

const KIND_LABEL = { monster: 'Quái thú', spell: 'Phép', trap: 'Bẫy' } as const;
const POSITION_LABEL = {
  Attack: 'Thế công',
  DefenseUp: 'Thế thủ (ngửa)',
  DefenseDown: 'Thế thủ (úp)',
} as const;

/** Text for the card detail panel. `null` = a card the viewer may not know (or nothing selected). */
export function formatDetail(
  detail: CardDetail | null | undefined,
  hiddenSelected = false,
): string {
  if (!detail) return hiddenSelected ? strings.detailHidden : strings.detailEmpty;
  const lines = [detail.name, KIND_LABEL[detail.kind]];
  if (detail.level !== null) lines[1] += ` · Level ${detail.level}`;
  if (detail.atk !== null && detail.def !== null)
    lines.push(`ATK ${detail.atk} / DEF ${detail.def}`);
  if (detail.position) lines.push(POSITION_LABEL[detail.position]);
  if (detail.effectText) lines.push('', detail.effectText);
  return lines.join('\n');
}
