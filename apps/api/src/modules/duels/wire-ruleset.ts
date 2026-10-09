import type { RulesetConfig } from '@yugi/shared';

/**
 * Ruleset keys the engine understands but that are not on the wire yet: no duel the API creates may carry them, whoever
 * asks (a caller of `createDuel`, a Sandbox scenario). Task 4.8: `allowMonsterEffectActivation` — a monster activating
 * its Ignition effect from the field has no client action, no UI and no real card until task 4.8b; remove the key from
 * this list there, in the same change that puts the rest on the wire.
 */
export const ENGINE_ONLY_RULESET_KEYS = [
  'allowMonsterEffectActivation',
] as const satisfies readonly (keyof RulesetConfig)[];

/** A resolved ruleset (the one of a `GameState`) without the engine-only keys. */
export function withoutEngineOnlyKeys(ruleset: RulesetConfig): RulesetConfig {
  if (!ENGINE_ONLY_RULESET_KEYS.some((key) => key in ruleset)) return ruleset;
  const kept: Partial<RulesetConfig> = { ...ruleset };
  for (const key of ENGINE_ONLY_RULESET_KEYS) delete kept[key];
  return kept as RulesetConfig;
}

/** `ruleset` overrides without the engine-only keys; undefined when nothing is left (or nothing was given). */
export function wireRuleset<T extends Partial<RulesetConfig>>(
  ruleset: T | undefined,
): Omit<T, (typeof ENGINE_ONLY_RULESET_KEYS)[number]> | undefined {
  if (ruleset === undefined) return undefined;
  const kept = Object.fromEntries(
    Object.entries(ruleset).filter(
      ([key]) => !(ENGINE_ONLY_RULESET_KEYS as readonly string[]).includes(key),
    ),
  ) as Omit<T, (typeof ENGINE_ONLY_RULESET_KEYS)[number]>;
  return Object.keys(kept).length === 0 ? undefined : kept;
}
