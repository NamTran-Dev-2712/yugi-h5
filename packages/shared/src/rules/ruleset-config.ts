import { z } from 'zod';

/**
 * Knobs for rules that differ between rulesets or that Yugi H5 may handle
 * differently from standard Yu-Gi-Oh. Defaults = early Master Rule. The
 * resolved config lives in `GameState.ruleset` so replays reproduce exactly.
 * See docs/plan/rules-coverage.md and docs/reference/notes/rules.md.
 */
export const RulesetConfigSchema = z
  .object({
    /**
     * C2/C10 [DECISION, based on a hypothesis]: 8000 for both sides (video #2, 4/4 duels); the
     * 10000 seen in video #1 is assumed to be another mode. StartDuel may override per side.
     */
    startingLP: z.number().int().min(1).default(8000),
    /** [REF] video #2 (4/4 duels): 5 cards. */
    openingHandSize: z.number().int().min(0).default(5),
    handLimit: z.number().int().min(0).default(6),
    /** G1 [RULE]: first player skips the draw and cannot attack on turn 1. */
    firstTurnDraw: z.boolean().default(false),
    firstTurnAttack: z.boolean().default(false),
    /** G12 [DECISION]. */
    deckMin: z.number().int().min(0).default(40),
    deckMax: z.number().int().min(0).default(60),
    copyLimit: z.number().int().min(1).default(3),
    /** G8 [DECISION]: Fusion in P4; state keeps room for an Extra Deck. C3 [REF, low: 1 source]: 20. */
    extraDeckSize: z.number().int().min(0).max(20).default(20),
    /** C1 [DECISION]: no Link/EX zone in P1-P4; stored only, engine ignores it (default 0). */
    extraMonsterZones: z.number().int().min(0).max(2).default(0),
    fieldSpellReplace: z.boolean().default(true),
    /** G5 [DECISION]: ask "Activate?" when a legal response exists, or auto-pass. */
    chainPrompt: z.enum(['ask', 'auto-pass']).default('ask'),
    /** G7 [DECISION]: null = no timer (solo); PvP uses 60. */
    turnTimerSec: z.number().int().min(1).nullable().default(null),
    afkLossThreshold: z.number().int().min(1).default(3),
    /** G11 [DECISION]. */
    allowSurrender: z.boolean().default(true),
    /** C11 [DECISION]: a Trap must be Set face-down before it can be activated. */
    allowTrapActivationFromHand: z.boolean().default(false),
    /** C11 [RULE]: a Trap cannot be activated on the turn it was Set. */
    trapSetTurnDelay: z.boolean().default(true),
  })
  .refine((r) => r.deckMin <= r.deckMax, {
    message: 'deckMin must be <= deckMax',
    path: ['deckMin'],
  });

export type RulesetConfig = z.infer<typeof RulesetConfigSchema>;

export const DEFAULT_RULESET: RulesetConfig = RulesetConfigSchema.parse({});

/** Applies overrides onto the defaults and validates. Throws on invalid input. */
export function resolveRuleset(overrides: Partial<RulesetConfig> = {}): RulesetConfig {
  return RulesetConfigSchema.parse(overrides);
}
