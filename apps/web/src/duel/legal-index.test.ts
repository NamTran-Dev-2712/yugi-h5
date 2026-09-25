import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { loadFixture } from './fixtures';
import {
  attackers,
  attackTargets,
  draggableHandCards,
  isListed,
  positionOptions,
  promptAnswers,
  sameAction,
  summonOptions,
} from './legal-index';

const legalOf = (name: Parameters<typeof loadFixture>[0]) => loadFixture(name).legalActions;

describe('sameAction / isListed (structural)', () => {
  const a: PlayerAction = {
    type: 'NormalSummon',
    payload: { playerIndex: 0, cardInstanceId: 'x', zoneIndex: 1, tributeInstanceIds: ['t'] },
  };
  it('ignores key order but not values', () => {
    const reordered = {
      payload: { tributeInstanceIds: ['t'], zoneIndex: 1, cardInstanceId: 'x', playerIndex: 0 },
      type: 'NormalSummon',
    } as PlayerAction;
    expect(sameAction(a, reordered)).toBe(true);
    expect(sameAction(a, { ...a, payload: { ...a.payload, zoneIndex: 2 } } as PlayerAction)).toBe(
      false,
    );
    expect(sameAction(a, { ...a, type: 'SetMonster' } as PlayerAction)).toBe(false);
  });
  it('tribute lists are compared as given (a missing list is not an empty one)', () => {
    const none = {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'x', zoneIndex: 1 },
    } as PlayerAction;
    expect(sameAction(a, none)).toBe(false);
  });
  it('isListed finds only what the server listed', () => {
    const legal = [a];
    expect(isListed(legal, structuredClone(a))).toBe(true);
    expect(isListed(legal, { ...a, payload: { ...a.payload, zoneIndex: 4 } } as PlayerAction)).toBe(
      false,
    );
  });
});

describe('draggableHandCards', () => {
  it('lists hand cards that have a summon/set action, and nothing else', () => {
    expect(draggableHandCards(legalOf('summon-choice'), 0).sort()).toEqual(['p0-1', 'p0-3']);
  });
  it('is empty when Normal Summon is used / not the phase (no summon actions listed)', () => {
    expect(draggableHandCards(legalOf('drag-illegal'), 0)).toEqual([]);
    expect(draggableHandCards(legalOf('attack'), 0)).toEqual([]);
  });
  it('ignores actions of the other seat', () => {
    expect(draggableHandCards(legalOf('summon-choice'), 1)).toEqual([]);
  });
});

describe('summonOptions', () => {
  it('groups Normal Summon and Set per zone, only zones the server listed', () => {
    const opts = summonOptions(legalOf('summon-choice'), 0, 'p0-1');
    expect(opts.map((o) => o.zoneIndex)).toEqual([0, 1, 3, 4]);
    for (const o of opts) {
      expect(o.normal).toHaveLength(1);
      expect(o.set).toHaveLength(1);
    }
  });
  it('keeps one action per tribute choice, including a zone freed by its own tribute', () => {
    const opts = summonOptions(legalOf('tribute'), 0, 'p0-1');
    expect(opts.map((o) => o.zoneIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(opts.find((o) => o.zoneIndex === 0)!.normal).toHaveLength(2);
    const z1 = opts.find((o) => o.zoneIndex === 1)!;
    expect(z1.normal).toHaveLength(1);
    expect(z1.normal[0]!.payload.tributeInstanceIds).toEqual(['p0-10']);
  });
  it('is empty for a card with no action', () => {
    expect(summonOptions(legalOf('summon-choice'), 0, 'p0-2')).toEqual([]);
  });
});

describe('attackers / attackTargets', () => {
  it('lists monsters that can attack and their listed targets', () => {
    expect(attackers(legalOf('attack'), 0).sort()).toEqual(['p0-10', 'p0-11']);
    const t = attackTargets(legalOf('attack'), 0, 'p0-10');
    expect(t.map((x) => x.targetInstanceId).sort()).toEqual(['p1-10', 'p1-11', 'p1-12']);
  });
  it('represents a direct attack as target null', () => {
    const t = attackTargets(legalOf('attack-direct'), 0, 'p0-10');
    expect(t).toHaveLength(1);
    expect(t[0]!.targetInstanceId).toBeNull();
  });
  it('is empty outside the Battle phase (no DeclareAttack listed)', () => {
    expect(attackers(legalOf('midgame'), 0)).toEqual([]);
  });
});

describe('positionOptions / promptAnswers', () => {
  it('lists the listed position changes of a monster', () => {
    const o = positionOptions(legalOf('summon-choice'), 0, 'p0-10');
    expect(o).toHaveLength(1);
    expect(o[0]!.payload.toPosition).toBe('DefenseUp');
    expect(positionOptions(legalOf('summon-choice'), 0, 'p0-1')).toEqual([]);
  });
  it('lists prompt answers for the matching prompt only', () => {
    const legal = legalOf('handfull');
    expect(promptAnswers(legal, 0, 'discard-5')).toHaveLength(7);
    expect(promptAnswers(legal, 0, 'other')).toEqual([]);
  });
});
