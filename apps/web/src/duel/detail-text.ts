import { t } from '../i18n/i18n';
import type { CardDetail } from './presenter';
import { strings } from './strings';

/** Text for the card detail panel. `null` = a card the viewer may not know (or nothing selected). */
export function formatDetail(
  detail: CardDetail | null | undefined,
  hiddenSelected = false,
): string {
  if (!detail) return hiddenSelected ? strings.detailHidden : strings.detailEmpty;
  const lines = [detail.name, t(`detail.kind.${detail.kind}`)];
  if (detail.level !== null) lines[1] += ` · ${t('detail.level', { level: detail.level })}`;
  if (detail.atk !== null && detail.def !== null)
    lines.push(t('detail.atkDef', { atk: detail.atk, def: detail.def }));
  if (detail.position) lines.push(t(`detail.position.${detail.position}`));
  if (detail.effectText) lines.push('', detail.effectText);
  return lines.join('\n');
}
