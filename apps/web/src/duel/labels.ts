import type { CardView, StateView } from '@yugi/shared';
import { cardName } from './card-text';
import { t } from '../i18n/i18n';
import type { CardLookup } from './presenter';

/** Readable label for a card instance against the view being shown. Hidden cards stay hidden in the text. */
export function instanceLabelIn(view: StateView, instanceId: string, lookup: CardLookup): string {
  for (const p of view.players) {
    const pool: CardView[] = [
      ...p.hand,
      ...p.graveyard,
      ...p.banished,
      ...p.board.monsterZones.filter((c): c is CardView => c !== null),
      ...p.board.spellTrapZones.filter((c): c is CardView => c !== null),
      ...(p.board.fieldZone ? [p.board.fieldZone] : []),
    ];
    const found = pool.find((c) => c.instanceId === instanceId);
    if (!found) continue;
    if (found.hidden) return t('label.hiddenCard');
    if (found.ownerIndex !== view.viewerIndex && found.position === 'DefenseDown')
      return t('label.faceDownCard');
    const d = lookup(found.definitionId);
    return d ? cardName(d) : found.definitionId;
  }
  return instanceId;
}
