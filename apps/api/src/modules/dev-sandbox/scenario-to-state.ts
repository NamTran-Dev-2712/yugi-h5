import { createRng, type CardInstance, type GameState, type PlayerState } from '@yugi/game-engine';
import { resolveRuleset, type CardDefinition, type Scenario } from '@yugi/shared';
import { DuelServiceError } from '../duels/duel-errors';

type Slot = CardInstance | null;
type Zones = [Slot, Slot, Slot, Slot, Slot];

export interface ScenarioIdentity {
  readonly matchId: string;
  readonly playerIds: readonly [string, string];
}

/**
 * Builds the `GameState` a Sandbox scenario describes (dev tool). Pure: no I/O, no clock. The engine has no way to
 * start from an arbitrary board, so this mirrors what `StartDuel` builds (instance ids `p<seat>-<n>`, seeded rng,
 * same fields); a test compares the two shapes so an engine change cannot make them drift silently. Everything after
 * the load still goes through `applyAction`. Every problem is collected, then thrown once as `INVALID_SCENARIO`.
 */
export function scenarioToState(
  scenario: Scenario,
  identity: ScenarioIdentity,
  lookup: (definitionId: string) => CardDefinition | undefined,
): GameState {
  const problems: string[] = [];

  let ruleset;
  try {
    const overrides = Object.fromEntries(
      Object.entries(scenario.ruleset ?? {}).filter(([, v]) => v !== undefined),
    );
    ruleset = resolveRuleset(overrides);
  } catch (e) {
    problems.push(`ruleset: ${e instanceof Error ? e.message : 'invalid'}`);
  }

  const players = ([0, 1] as const).map((seat): PlayerState => {
    const src = scenario.players[seat];
    let n = 0;
    const make = (
      where: string,
      definitionId: string,
      position: CardInstance['position'],
      extra: Partial<CardInstance> = {},
    ): CardInstance => {
      if (!lookup(definitionId)) {
        problems.push(`player ${seat} ${where}: unknown card "${definitionId}"`);
      }
      return {
        instanceId: `p${seat}-${n++}`,
        definitionId,
        position,
        ownerIndex: seat,
        ...extra,
      };
    };

    const hand = src.hand.map((id) => make('hand', id, null));
    const deck = src.deck.map((id) => make('deck', id, null));

    const monsterZones: Zones = [null, null, null, null, null];
    for (const m of src.field.monsters) {
      if (lookup(m.card) && lookup(m.card)?.kind !== 'Monster') {
        problems.push(`player ${seat} monsters: "${m.card}" is not a Monster card`);
      }
      if (monsterZones[m.zone]) {
        problems.push(`player ${seat} monsters: zone ${m.zone} is used twice`);
        continue;
      }
      monsterZones[m.zone] = make(
        'monsters',
        m.card,
        m.position,
        m.summonedTurn !== undefined ? { summonedTurn: m.summonedTurn } : {},
      );
    }

    const spellTrapZones: Zones = [null, null, null, null, null];
    for (const s of src.field.spellTraps) {
      if (lookup(s.card) && lookup(s.card)?.kind === 'Monster') {
        problems.push(`player ${seat} spellTraps: "${s.card}" is a Monster card`);
      }
      if (spellTrapZones[s.zone]) {
        problems.push(`player ${seat} spellTraps: zone ${s.zone} is used twice`);
        continue;
      }
      spellTrapZones[s.zone] = make('spellTraps', s.card, s.position);
    }

    const graveyard = src.gy.map((id) => make('gy', id, null));

    return {
      playerId: identity.playerIds[seat],
      lifePoints: src.lp,
      board: { monsterZones, spellTrapZones, fieldZone: null },
      hand,
      deck,
      graveyard,
      banished: [],
      extraDeck: [],
      hasNormalSummonedThisTurn: false,
    };
  });

  if (problems.length > 0 || ruleset === undefined) {
    throw new DuelServiceError('INVALID_SCENARIO', problems.join('; '));
  }

  return {
    matchId: identity.matchId,
    rng: createRng(scenario.seed),
    ruleset,
    turnCount: scenario.turn.count,
    turnPlayerIndex: scenario.turn.player,
    phase: scenario.phase,
    players: [players[0]!, players[1]!],
    chainStack: [],
    pendingPrompt: null,
    winnerIndex: null,
    version: 1,
  };
}
