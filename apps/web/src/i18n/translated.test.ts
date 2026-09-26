import type { EventView, PlayerAction } from '@yugi/shared';
import { SAMPLE_CARDS } from '@yugi/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { describeAiAction } from '../debug/describe-ai-action';
import { describeEvent } from '../debug/describe-event';
import { formatDetail } from '../duel/detail-text';
import { messageFor } from '../duel/error-messages';
import { loadFixture } from '../duel/fixtures';
import { instanceLabelIn } from '../duel/labels';
import { present } from '../duel/presenter';
import { strings } from '../duel/strings';
import { setLang } from './i18n';

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string) => byId.get(id);
const ctx = { cardName: (id: string) => `Name(${id})`, instanceLabel: (id: string) => `<${id}>` };
const card = {
  hidden: false,
  instanceId: 'p0-1',
  definitionId: 'SMP-001',
  position: null,
  ownerIndex: 0,
} as const;

const EVENTS: Record<EventView['type'], { event: EventView; en: string }> = {
  DuelStarted: {
    event: { type: 'DuelStarted', matchId: 'm', turnPlayerIndex: 0 },
    en: 'Duel started, P0 goes first',
  },
  CardDrawn: {
    event: { type: 'CardDrawn', playerIndex: 0, card },
    en: 'P0 draws a card: Name(SMP-001)',
  },
  DeckOut: { event: { type: 'DeckOut', playerIndex: 1 }, en: 'P1 has no cards left to draw' },
  CardDiscarded: {
    event: { type: 'CardDiscarded', playerIndex: 0, instanceId: 'p0-2', definitionId: 'SMP-002' },
    en: 'P0 discards Name(SMP-002) to the Graveyard',
  },
  PhaseChanged: {
    event: { type: 'PhaseChanged', from: 'Main1', to: 'Battle', turnPlayerIndex: 0 },
    en: "Phase Main1 → Battle (P0's turn)",
  },
  TurnChanged: {
    event: { type: 'TurnChanged', turnCount: 2, turnPlayerIndex: 1 },
    en: 'Turn 2: P1',
  },
  NormalSummoned: {
    event: {
      type: 'NormalSummoned',
      playerIndex: 0,
      instanceId: 'p0-3',
      definitionId: 'SMP-003',
      zoneIndex: 2,
    },
    en: 'P0 Summons Name(SMP-003) in zone 2',
  },
  MonsterSet: {
    event: { type: 'MonsterSet', playerIndex: 1, instanceId: 'p1-3', zoneIndex: 0 },
    en: 'P1 Sets a monster in zone 0',
  },
  MonsterTributed: {
    event: {
      type: 'MonsterTributed',
      ownerIndex: 0,
      instanceId: 'p0-3',
      definitionId: 'SMP-003',
      zoneIndex: 1,
    },
    en: 'P0 tributes Name(SMP-003) (zone 1)',
  },
  PositionChanged: {
    event: {
      type: 'PositionChanged',
      playerIndex: 0,
      instanceId: 'p0-3',
      definitionId: 'SMP-003',
      zoneIndex: 1,
      from: 'Attack',
      to: 'DefenseUp',
    },
    en: 'P0 changes the position of Name(SMP-003): Attack → DefenseUp',
  },
  MonsterFlipped: {
    event: {
      type: 'MonsterFlipped',
      ownerIndex: 1,
      instanceId: 'p1-3',
      definitionId: 'SMP-004',
      zoneIndex: 0,
    },
    en: 'P1 flips Name(SMP-004) (zone 0)',
  },
  AttackDeclared: {
    event: {
      type: 'AttackDeclared',
      playerIndex: 0,
      attackerInstanceId: 'p0-3',
      targetInstanceId: 'p1-3',
    },
    en: 'P0 attacks <p1-3> with <p0-3>',
  },
  MonsterDestroyed: {
    event: {
      type: 'MonsterDestroyed',
      ownerIndex: 1,
      instanceId: 'p1-3',
      definitionId: 'SMP-004',
      zoneIndex: 0,
    },
    en: 'P1 loses monster Name(SMP-004) (zone 0), destroyed',
  },
  DamageDealt: {
    event: { type: 'DamageDealt', playerIndex: 1, amount: 700 },
    en: 'P1 loses 700 LP',
  },
  DuelEnded: {
    event: { type: 'DuelEnded', winnerIndex: 0, reason: 'SURRENDER' },
    en: 'Duel over: P0 wins (SURRENDER)',
  },
  SpellTrapSet: {
    event: { type: 'SpellTrapSet', playerIndex: 1, instanceId: 'p1-8', zoneIndex: 2 },
    en: 'P1 sets a Spell/Trap in zone 2',
  },
  EffectActivated: {
    event: {
      type: 'EffectActivated',
      playerIndex: 0,
      instanceId: 'p0-7',
      definitionId: 'SMP-101',
      effectId: 'draw-one',
    },
    en: 'P0 activates Name(SMP-101)',
  },
  EffectResolved: {
    event: {
      type: 'EffectResolved',
      playerIndex: 0,
      instanceId: 'p0-7',
      definitionId: 'SMP-101',
      effectId: 'draw-one',
    },
    en: "P0's Name(SMP-101) finished resolving",
  },
  CardSentToGraveyard: {
    event: {
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'p0-7',
      definitionId: 'SMP-101',
      from: 'Hand',
    },
    en: "P0's Name(SMP-101) goes to the Graveyard",
  },
  LifePointsRecovered: {
    event: { type: 'LifePointsRecovered', playerIndex: 0, amount: 500 },
    en: 'P0 gains 500 LP',
  },
  LifePointsPaid: {
    event: { type: 'LifePointsPaid', playerIndex: 1, amount: 300 },
    en: 'P1 pays 300 LP',
  },
  SpellTrapDestroyed: {
    event: {
      type: 'SpellTrapDestroyed',
      ownerIndex: 1,
      instanceId: 'p1-8',
      definitionId: 'SMP-201',
      zoneIndex: 2,
    },
    en: 'P1 loses Spell/Trap Name(SMP-201) (zone 2), destroyed',
  },
};

describe('English wording', () => {
  beforeEach(() => setLang('en'));
  afterEach(() => setLang('vi'));

  it.each(Object.entries(EVENTS))('describeEvent %s', (_t, { event, en }) => {
    expect(describeEvent(event, ctx)).toBe(en);
  });
  it('describeEvent: hidden draw, direct attack, draw', () => {
    expect(
      describeEvent(
        {
          type: 'CardDrawn',
          playerIndex: 1,
          card: { hidden: true, instanceId: 'x', ownerIndex: 1 },
        },
        ctx,
      ),
    ).toBe('P1 draws a card (hidden)');
    expect(
      describeEvent(
        {
          type: 'AttackDeclared',
          playerIndex: 1,
          attackerInstanceId: 'p1-2',
          targetInstanceId: null,
        },
        ctx,
      ),
    ).toBe('P1 attacks directly with <p1-2>');
    expect(describeEvent({ type: 'DuelEnded', winnerIndex: null, reason: 'LP_ZERO' }, ctx)).toBe(
      'Duel over: draw (LP_ZERO)',
    );
  });

  it('describeAiAction', () => {
    const say = (a: PlayerAction) => describeAiAction(a, { instanceLabel: (id) => `«${id}»` });
    expect(say({ type: 'EndPhase', payload: { playerIndex: 1 } })).toBe('🤖 AI ends the phase');
    expect(
      say({ type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'a', zoneIndex: 2 } }),
    ).toBe('🤖 AI Normal Summons «a» in zone 2');
    expect(
      say({
        type: 'NormalSummon',
        payload: {
          playerIndex: 1,
          cardInstanceId: 'a',
          zoneIndex: 0,
          tributeInstanceIds: ['b', 'c'],
        },
      }),
    ).toBe('🤖 AI Tribute Summons «a» in zone 0, tributing «b», «c»');
    expect(
      say({ type: 'SetMonster', payload: { playerIndex: 1, cardInstanceId: 'a', zoneIndex: 1 } }),
    ).toBe('🤖 AI Sets «a» in zone 1');
    expect(
      say({
        type: 'ChangePosition',
        payload: { playerIndex: 1, cardInstanceId: 'a', toPosition: 'DefenseUp' },
      }),
    ).toBe('🤖 AI changes «a» to DefenseUp');
    expect(
      say({ type: 'DeclareAttack', payload: { playerIndex: 1, attackerInstanceId: 'a' } }),
    ).toBe('🤖 AI attacks directly with «a»');
    expect(
      say({
        type: 'DeclareAttack',
        payload: { playerIndex: 1, attackerInstanceId: 'a', targetInstanceId: 'z' },
      }),
    ).toBe('🤖 AI attacks «z» with «a»');
    expect(
      say({
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'd', cardInstanceIds: ['a', 'b'] },
      }),
    ).toBe('🤖 AI discards «a», «b» to the Graveyard');
    expect(say({ type: 'Surrender', payload: { playerIndex: 1 } })).toBe('🤖 AI surrenders');
    expect(
      say({
        type: 'SetSpellTrap',
        payload: { playerIndex: 1, cardInstanceId: 'p1-8', zoneIndex: 3 },
      }),
    ).toBe('🤖 AI Sets «p1-8» in Spell/Trap zone 3');
    expect(
      say({
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-9', effectId: 'e1' },
      }),
    ).toBe('🤖 AI activates «p1-9»');
  });

  it('messageFor', () => {
    expect(messageFor({ status: 409, code: 'ACTION_REJECTED', engineCode: 'ZONE_OCCUPIED' })).toBe(
      'That zone already has a monster.',
    );
    expect(messageFor({ status: 403, code: 'NOT_OWNER' })).toBe('You do not control this duel.');
    expect(messageFor({ status: 0, code: 'NETWORK_ERROR' })).toBe('Lost connection to the server.');
    expect(messageFor({ status: 429 })).toBe('Too many requests, try again in a moment.');
    expect(messageFor({ status: 418, code: 'TEAPOT', engineCode: 'SOMETHING_NEW' })).toBe(
      'Could not do that (code SOMETHING_NEW).',
    );
  });

  it('labels and detail', () => {
    const f = loadFixture('midgame');
    expect(instanceLabelIn(f.view, 'p1-11', lookup)).toBe('hidden card');
    const m = present(f.view, f.legalActions, { lookup });
    const text = formatDetail(m.cards.find((c) => c.id === 'p0-10')!.detail);
    expect(text).toContain('Monster · Level 3');
    expect(text).toContain('ATK 1200 / DEF 800');
    expect(text).toContain('Attack Position');
    expect(formatDetail(null)).toBe(strings.detailEmpty);
    expect(strings.detailEmpty).toBe('Hover / tap a card to see its details');
  });

  it('strings facade follows the language at read time', () => {
    expect(strings.endTurn).toBe('End turn');
    expect(strings.phase.Main1).toBe('Main 1');
    expect(strings.logCategory.combat).toBe('Battle');
    expect(strings.win).toBe('YOU WIN');
    setLang('vi');
    expect(strings.endTurn).toBe('Kết thúc lượt');
    expect(strings.logCategory.combat).toBe('Đánh');
  });
});
