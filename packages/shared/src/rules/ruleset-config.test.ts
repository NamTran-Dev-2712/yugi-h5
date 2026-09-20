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
      extraDeckSize: 20,
      extraMonsterZones: 0,
    });
  });

  it('C1 [DECISION]: extraMonsterZones is stored only (0-2); Extra Deck holds up to 20 (C3)', () => {
    expect(resolveRuleset({ extraMonsterZones: 2 }).extraMonsterZones).toBe(2);
    expect(RulesetConfigSchema.safeParse({ extraMonsterZones: 3 }).success).toBe(false);
    expect(RulesetConfigSchema.safeParse({ extraMonsterZones: -1 }).success).toBe(false);
    expect(resolveRuleset({ extraDeckSize: 20 }).extraDeckSize).toBe(20);
    expect(RulesetConfigSchema.safeParse({ extraDeckSize: 21 }).success).toBe(false);
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

  it('C11 defaults: trap cannot be activated from hand and must wait a turn after Set', () => {
    expect(DEFAULT_RULESET.allowTrapActivationFromHand).toBe(false);
    expect(DEFAULT_RULESET.trapSetTurnDelay).toBe(true);
  });

  it('C11 keys can be overridden', () => {
    const ruleset = resolveRuleset({
      allowTrapActivationFromHand: true,
      trapSetTurnDelay: false,
    });

    expect(ruleset.allowTrapActivationFromHand).toBe(true);
    expect(ruleset.trapSetTurnDelay).toBe(false);
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
