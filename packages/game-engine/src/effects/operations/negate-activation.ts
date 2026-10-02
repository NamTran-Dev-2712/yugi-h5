import type { OperationHandler } from './types.js';

/**
 * Task 4.4: negates the activation of the link directly below the resolving one (`ctx.respondsTo`, the activation this
 * effect answered). The operation only states the fact (`ChainLinkNegated`); `effects/chain.ts` reads it while the chain
 * resolves — it sends the negated card to the graveyard at once and never resolves that link. With nothing below
 * (cannot happen for an activation the engine accepted) nothing happens.
 */
export const applyNegateActivation: OperationHandler<'NegateActivation'> = (state, _op, ctx) => {
  const below = ctx.respondsTo;
  if (!below) return { state, events: [] };
  return {
    state,
    events: [
      {
        type: 'ChainLinkNegated',
        linkId: below.linkId,
        playerIndex: below.playerIndex,
        instanceId: below.card.instanceId,
        definitionId: below.card.definitionId,
        effectId: below.effectId,
        byInstanceId: ctx.sourceInstanceId,
      },
    ],
  };
};
