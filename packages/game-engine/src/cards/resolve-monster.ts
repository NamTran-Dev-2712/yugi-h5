import type { MonsterCardDefinition } from '@yugi/shared';
import type { ActionContext } from '../actions/types.js';
import type { EngineErrorCode } from '../errors.js';
import type { CardInstance } from '../state/types.js';

/** The Monster definition of `card`, or `reject` (moved out of `summon.ts` in task 3.4c to avoid an import cycle). */
export function resolveMonster(
  card: CardInstance,
  ctx: ActionContext,
  reject: (code: EngineErrorCode, reason: string) => never,
): MonsterCardDefinition {
  if (!ctx.cardDefinitions)
    return reject('NO_CARD_RESOLVER', 'no card definition resolver was provided.');
  const definition = ctx.cardDefinitions(card.definitionId);
  if (!definition)
    return reject(
      'CARD_DEFINITION_NOT_FOUND',
      `card definition "${card.definitionId}" was not found.`,
    );
  if (definition.kind !== 'Monster')
    return reject('NOT_A_MONSTER', `"${definition.name.en}" is not a Monster card.`);
  return definition;
}
