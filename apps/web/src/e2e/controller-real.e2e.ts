import { describe, expect, it } from 'vitest';
import type { PlayerAction } from '@yugi/shared';
import { createDuelController } from '../duel/duel-controller';
import { cardLookup } from '../duel/services';
import { createRealApi } from './real-api';

/**
 * Step 0 of task 2.8: the REAL DuelController over the REAL network (no fake API) against a running API.
 * Creates a solo-vs-ai duel, passes at least 3 turns, answers the discard prompt when it appears, and checks the AI
 * moved and the log grew.
 */
describe('DuelController against the real API', () => {
  it('plays 3+ turns with the AI', async () => {
    const c = createDuelController({ api: createRealApi(), lookup: cardLookup });
    await c.start();
    expect(c.getState().error).toBeNull();
    expect(c.getState().view?.viewerIndex).toBe(0);

    const startTurn = c.getState().view!.turnCount;
    let discards = 0;
    let turns = 0;
    let lastTurn = startTurn;
    for (let i = 0; i < 40 && turns < 3; i++) {
      const s = c.getState();
      if (s.view!.winnerIndex !== null) break;
      if (s.view!.pendingPrompt) {
        const answer = s.legalActions.find(
          (a): a is Extract<PlayerAction, { type: 'ResolvePendingPrompt' }> =>
            a.type === 'ResolvePendingPrompt' && a.payload.cardInstanceIds.length === 1,
        );
        expect(answer, 'a discard answer is listed').toBeDefined();
        await c.submit(answer!);
        discards++;
        continue;
      }
      await c.press('endTurn');
      const view = c.getState().view!;
      if (view.turnCount !== lastTurn) turns += 1;
      lastTurn = view.turnCount;
    }
    const end = c.getState();
    console.log(
      `turns passed ${turns}, discards answered ${discards}, log lines ${end.log.length}, turnCount ${startTurn} -> ${end.view!.turnCount}`,
    );
    expect(turns).toBeGreaterThanOrEqual(3);
    expect(end.error).toBeNull();
    expect(end.busy).toBe(false);
    expect(end.log.some((l) => l.includes('AI'))).toBe(true);
    // Control is back with the human (or the duel ended).
    expect(end.view!.turnPlayerIndex === 0 || end.view!.winnerIndex !== null).toBe(true);
  });
});
