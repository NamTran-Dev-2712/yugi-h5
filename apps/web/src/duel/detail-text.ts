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
  if (detail.atk !== null && detail.def !== null) {
    // Continuous modifiers (task 3.7): the current values first, then the printed ones.
    const modified = detail.effAtk !== null || detail.effDef !== null;
    lines.push(
      t('detail.atkDef', { atk: detail.effAtk ?? detail.atk, def: detail.effDef ?? detail.def }),
    );
    if (modified) lines.push(t('detail.printedStats', { atk: detail.atk, def: detail.def }));
  }
  // Task 4.3b: a Field / Continuous card resting on the field says it is in force (a battle position means nothing
  // for it); every other card keeps its position line.
  if (detail.active) lines.push(t('detail.active'));
  else if (detail.position) lines.push(t(`detail.position.${detail.position}`));
  if (detail.effectText) lines.push('', detail.effectText);
  return lines.join('\n');
}
