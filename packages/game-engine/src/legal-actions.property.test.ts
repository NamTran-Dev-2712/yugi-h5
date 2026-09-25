import { describe, expect, it } from 'vitest';
import type { Action, ActionContext } from './actions/types.js';
import { applyAction } from './apply-action.js';
import { EngineError } from './errors.js';
import { getLegalActions } from './legal-actions.js';
import { createRng, nextInt } from './rng/seeded-rng.js';
import type { RngState } from './rng/seeded-rng.js';
import type { GameState } from './state/types.js';
import { formatFuzzFailure, runFuzz } from './testing/fuzz/fuzz.js';

/*
 * Property test: replays fuzz duels (fixed seeds; the seed is printed on failure) and at EVERY state checks that
 *  (a) every listed action is accepted by applyAction, (b) actions NOT listed — perturbed/mistyped variants of the
 *      listed ones plus junk — are rejected, (c) no duplicates, (d) a running duel always has a way forward.
 * Draw/StartDuel are excluded from (b): the engine accepts Draw, but it is server-internal and never listable.
 */

const SEEDS = Number(process.env.LEGAL_SEEDS ?? 8);
const STEPS = Number(process.env.LEGAL_STEPS ?? 200);

function accepts(state: GameState, action: Action, ctx: ActionContext): boolean {
  try {
    applyAction(state, action, ctx);
    return true;
  } catch (error) {
    if (error instanceof EngineError) return false;
    throw error;
  }
}

function makeInt(seed: string): (max: number) => number {
  let rng: RngState = createRng(seed);
  return (max) => {
    const [v, next] = nextInt(rng, max);
    rng = next;
    return v;
  };
}

function allIds(state: GameState): string[] {
  const ids: string[] = ['bogus', ''];
  for (const p of state.players) {
    for (const c of [...p.hand, ...p.deck, ...p.graveyard]) ids.push(c.instanceId);
    for (const c of p.board.monsterZones) if (c) ids.push(c.instanceId);
  }
  return ids;
}

/** Variants of `action` that are wrong in one structural way (kept only if not themselves listed). */
function perturb(action: Action, ids: string[], int: (n: number) => number): Action[] {
  if (action.type === 'StartDuel' || action.type === 'Draw') return [];
  const p = action.payload;
  const otherSeat = (p.playerIndex === 0 ? 1 : 0) as 0 | 1;
  const pick = () => ids[int(ids.length)]!;
  const out: Action[] = [{ ...action, payload: { ...p, playerIndex: otherSeat } } as Action];
  switch (action.type) {
    case 'NormalSummon':
    case 'SetMonster': {
      const { payload } = action;
      out.push({
        ...action,
        payload: { ...payload, zoneIndex: (payload.zoneIndex + 1 + int(4)) % 5 },
      });
      out.push({ ...action, payload: { ...payload, zoneIndex: 7 } });
      out.push({ ...action, payload: { ...payload, cardInstanceId: pick() } });
      out.push({ ...action, payload: { ...payload, tributeInstanceIds: [pick()] } });
      out.push({
        ...action,
        payload: { ...payload, tributeInstanceIds: [pick(), pick(), pick()] },
      });
      break;
    }
    case 'SetSpellTrap':
      out.push({
        ...action,
        payload: { ...action.payload, zoneIndex: (action.payload.zoneIndex + 1 + int(4)) % 5 },
      });
      out.push({ ...action, payload: { ...action.payload, zoneIndex: 7 } });
      out.push({ ...action, payload: { ...action.payload, cardInstanceId: pick() } });
      break;
    case 'ActivateEffect':
      out.push({ ...action, payload: { ...action.payload, effectId: 'bogus' } });
      out.push({ ...action, payload: { ...action.payload, cardInstanceId: pick() } });
      out.push({ ...action, payload: { ...action.payload, costInstanceIds: [pick()] } });
      out.push({
        ...action,
        payload: {
          ...action.payload,
          costInstanceIds: [...(action.payload.costInstanceIds ?? []), pick()],
        },
      });
      break;
    case 'ChangePosition':
      out.push({ ...action, payload: { ...p, cardInstanceId: pick() } } as Action);
      out.push({ ...action, payload: { ...action.payload, toPosition: 'DefenseUp' } });
      out.push({ ...action, payload: { ...action.payload, toPosition: 'Attack' } });
      break;
    case 'DeclareAttack':
      out.push({ ...action, payload: { ...action.payload, targetInstanceId: pick() } });
      out.push({ ...action, payload: { ...action.payload, attackerInstanceId: pick() } });
      out.push({
        type: 'DeclareAttack',
        payload: {
          playerIndex: p.playerIndex,
          attackerInstanceId: action.payload.attackerInstanceId,
        },
      });
      break;
    case 'ResolvePendingPrompt':
      out.push({ ...action, payload: { ...action.payload, promptId: 'bogus' } });
      out.push({ ...action, payload: { ...action.payload, cardInstanceIds: [] } });
      out.push({
        ...action,
        payload: {
          ...action.payload,
          cardInstanceIds: [...action.payload.cardInstanceIds, pick()],
        },
      });
      break;
    default:
      break;
  }
  return out;
}

function junk(seat: 0 | 1, ids: string[], int: (n: number) => number): Action[] {
  const pick = () => ids[int(ids.length)]!;
  return [
    { type: 'EndPhase', payload: { playerIndex: seat } },
    { type: 'Surrender', payload: { playerIndex: seat } },
    {
      type: 'NormalSummon',
      payload: { playerIndex: seat, cardInstanceId: pick(), zoneIndex: int(5) },
    },
    {
      type: 'SetMonster',
      payload: { playerIndex: seat, cardInstanceId: pick(), zoneIndex: int(5) },
    },
    {
      type: 'SetSpellTrap',
      payload: { playerIndex: seat, cardInstanceId: pick(), zoneIndex: int(5) },
    },
    {
      type: 'ActivateEffect',
      payload: {
        playerIndex: seat,
        cardInstanceId: pick(),
        effectId: 'e1',
        costInstanceIds: [pick()],
      },
    },
    {
      type: 'ChangePosition',
      payload: { playerIndex: seat, cardInstanceId: pick(), toPosition: 'Attack' },
    },
    {
      type: 'DeclareAttack',
      payload: { playerIndex: seat, attackerInstanceId: pick(), targetInstanceId: pick() },
    },
    { type: 'DeclareAttack', payload: { playerIndex: seat, attackerInstanceId: pick() } },
    {
      type: 'ResolvePendingPrompt',
      payload: { playerIndex: seat, promptId: 'discard-1', cardInstanceIds: [pick()] },
    },
  ];
}

describe('getLegalActions — property (fuzzed duels)', () => {
  it(`agrees with applyAction on ${SEEDS} seeds × ${STEPS} steps`, () => {
    let statesChecked = 0;
    let listedTotal = 0;
    let negativesTotal = 0;

    for (let s = 0; s < SEEDS; s++) {
      const seed = `legal-prop-${s}`;
      const int = makeInt(`neg-${seed}`);
      const result = runFuzz({
        seed,
        steps: STEPS,
        onState: (state, ctx) => {
          statesChecked++;
          const lists = [getLegalActions(state, 0, ctx), getLegalActions(state, 1, ctx)] as const;
          // Perturbing playerIndex can land on the other seat's legal action, so "listed" = listed for either seat.
          const anyListed = new Set([...lists[0], ...lists[1]].map((a) => JSON.stringify(a)));
          for (const seat of [0, 1] as const) {
            const list = lists[seat];
            const keys = list.map((a) => JSON.stringify(a));
            const keySet = new Set(keys);
            if (keySet.size !== keys.length) return `seat ${seat}: duplicate legal actions`;
            listedTotal += list.length;

            for (const a of list) {
              if (!accepts(state, a, ctx))
                return `seat ${seat}: listed but rejected: ${JSON.stringify(a)}`;
            }

            if (state.winnerIndex !== null) {
              if (list.length !== 0) return `seat ${seat}: actions listed after the duel ended`;
              continue;
            }

            const ids = allIds(state);
            // Bounded sample per state (all variants of every listed action is too slow for the default suite).
            const sampled = Array.from(
              { length: Math.min(list.length, 8) },
              () => list[int(list.length)]!,
            );
            const negatives = [
              ...sampled.flatMap((a) => perturb(a, ids, int)),
              ...junk(seat, ids, int),
            ];
            for (const n of negatives) {
              if (anyListed.has(JSON.stringify(n))) continue;
              negativesTotal++;
              if (accepts(state, n, ctx))
                return `seat ${seat}: NOT listed but accepted: ${JSON.stringify(n)}`;
            }
          }

          if (state.winnerIndex === null) {
            const actor = state.pendingPrompt
              ? state.pendingPrompt.playerIndex
              : state.turnPlayerIndex;
            const list = getLegalActions(state, actor, ctx);
            const canMove = list.some(
              (a) =>
                a.type === 'EndPhase' ||
                a.type === 'Surrender' ||
                a.type === 'ResolvePendingPrompt',
            );
            if (!canMove) return `seat ${actor} is stuck: no EndPhase/Surrender/prompt answer`;
          }
          return null;
        },
      });
      if (!result.ok) throw new Error(`${formatFuzzFailure(result)}\n(seed ${seed})`);
    }

    console.info(
      `legal-actions property: ${statesChecked} states, ${listedTotal} listed, ${negativesTotal} negatives checked`,
    );
    expect(statesChecked).toBeGreaterThan(SEEDS * STEPS * 0.3);
    expect(negativesTotal).toBeGreaterThan(1000);
  }, 120_000);
});
