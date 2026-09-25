import { z } from 'zod';
import { PlayerActionSchema } from '../duel/action-schema.js';
import { RulesetConfigSchema } from '../rules/ruleset-config.js';

/**
 * Duel Sandbox scenario (dev tool, docs/plan/dev-tools-and-review.md). Shape only: whether the card ids exist and the
 * board is consistent is checked by apps/api when it builds the state. `turn` is `{count, player}` (the plan only said
 * "turn"): which turn number it is and whose turn.
 */

const Seat = z.union([z.literal(0), z.literal(1)]);
const Zone = z.number().int().min(0).max(4);
const CardId = z.string().min(1).max(64);
const Position = z.enum(['Attack', 'DefenseUp', 'DefenseDown']);

const FieldMonster = z
  .object({
    card: CardId,
    zone: Zone,
    position: Position,
    /** Turn it was Summoned/Set (engine turn stamp). Omitted = long ago, so it may attack / change position. */
    summonedTurn: z.number().int().min(0).optional(),
  })
  .strict();

const FieldSpellTrap = z
  .object({
    card: CardId,
    zone: Zone,
    /** `DefenseDown` = Set face-down (default); `Attack` = face-up. Same convention as the engine/StateView. */
    position: Position.default('DefenseDown'),
  })
  .strict();

const ScenarioPlayer = z
  .object({
    lp: z.number().int().min(1),
    hand: z.array(CardId).max(40),
    deck: z.array(CardId).max(60),
    field: z
      .object({
        monsters: z.array(FieldMonster).max(5),
        spellTraps: z.array(FieldSpellTrap).max(5),
      })
      .strict(),
    gy: z.array(CardId).max(60),
  })
  .strict();

export const ScenarioSchema = z
  .object({
    name: z.string().min(1).max(80),
    ruleset: RulesetConfigSchema.innerType().partial().strict().optional(),
    seed: z.string().min(1).max(64),
    players: z.tuple([ScenarioPlayer, ScenarioPlayer]),
    turn: z.object({ count: z.number().int().min(1), player: Seat }).strict(),
    phase: z.enum(['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End']),
    /** Applied in order through the normal engine path once the scenario is loaded. */
    script: z.array(PlayerActionSchema).max(200).optional(),
  })
  .strict();

export type Scenario = z.infer<typeof ScenarioSchema>;
