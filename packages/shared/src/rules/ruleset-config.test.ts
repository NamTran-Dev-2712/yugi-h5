import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET, RulesetConfigSchema, resolveRuleset } from './ruleset-config.js';

describe('RulesetConfig', () => {
  it('defaults to early Master Rule values', () => {
    expect(DEFAULT_RULESET).toMatchObject({
      startingLP: 8000,
      openingHandSize: 5,
      handLimit: 6,
      firstTurnDraw: false,
      firstTurnAttack: false,
      deckMin: 40,
      deckMax: 60,
      copyLimit: 3,
      chainPrompt: 'ask',
      turnTimerSec: null,
      allowSurrender: true,
    });
  });

  it('resolveRuleset with no argument returns the defaults', () => {
    expect(resolveRuleset()).toEqual(DEFAULT_RULESET);
  });

  it('resolveRuleset merges overrides onto the defaults', () => {
    const ruleset = resolveRuleset({ startingLP: 4000, turnTimerSec: 60 });

    expect(ruleset.startingLP).toBe(4000);
    expect(ruleset.turnTimerSec).toBe(60);
    expect(ruleset.handLimit).toBe(DEFAULT_RULESET.handLimit);
  });

  it('rejects invalid values', () => {
    expect(RulesetConfigSchema.safeParse({ startingLP: 0 }).success).toBe(false);
    expect(RulesetConfigSchema.safeParse({ chainPrompt: 'sometimes' }).success).toBe(false);
    expect(RulesetConfigSchema.safeParse({ deckMin: 61, deckMax: 60 }).success).toBe(false);
  });

  it('is plain JSON (serializable, replay-safe)', () => {
    expect(JSON.parse(JSON.stringify(DEFAULT_RULESET))).toEqual(DEFAULT_RULESET);
  });
});
