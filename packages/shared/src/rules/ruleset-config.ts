import { z } from 'zod';

/**
 * Knobs for rules that differ between rulesets or that Yugi H5 may handle
 * differently from standard Yu-Gi-Oh. Defaults = early Master Rule. The
 * resolved config lives in `GameState.ruleset` so replays reproduce exactly.
 * See docs/plan/rules-coverage.md and docs/reference/notes/rules.md.
 */
export const RulesetConfigSchema = z
  .object({
    /** [RULE]/[GUESS] until Yugi H5 reference confirms. */
    startingLP: z.number().int().min(1).default(8000),
    openingHandSize: z.number().int().min(0).default(5),
    handLimit: z.number().int().min(0).default(6),
    /** G1 [RULE]: first player skips the draw and cannot attack on turn 1. */
    firstTurnDraw: z.boolean().default(false),
    firstTurnAttack: z.boolean().default(false),
    /** G12 [DECISION]. */
    deckMin: z.number().int().min(0).default(40),
    deckMax: z.number().int().min(0).default(60),
    copyLimit: z.number().int().min(1).default(3),
    /** G8 [DECISION]: Fusion in P4; state keeps room for an Extra Deck. */
    extraDeckSize: z.number().int().min(0).max(15).default(15),
    fieldSpellReplace: z.boolean().default(true),
    /** G5 [DECISION]: ask "Activate?" when a legal response exists, or auto-pass. */
    chainPrompt: z.enum(['ask', 'auto-pass']).default('ask'),
    /** G7 [DECISION]: null = no timer (solo); PvP uses 60. */
    turnTimerSec: z.number().int().min(1).nullable().default(null),
    afkLossThreshold: z.number().int().min(1).default(3),
    /** G11 [DECISION]. */
    allowSurrender: z.boolean().default(true),
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
