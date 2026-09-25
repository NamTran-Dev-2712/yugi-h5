import { SAMPLE_CARDS, type PlayerAction, type StateView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { loadFixture, FIXTURE_NAMES } from './fixtures';
import { present, type CardLookup, type RenderModel } from './presenter';
import { strings } from './strings';

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup: CardLookup = (id) => byId.get(id);
const model = (name: (typeof FIXTURE_NAMES)[number], surrenderArmed = false): RenderModel => {
  const f = loadFixture(name);
  return present(f.view, f.legalActions, { lookup, surrenderArmed });
};

describe('present: numbers and text', () => {
  it('shows LP, deck/graveyard counts and turn/phase for midgame', () => {
    const m = model('midgame');
    expect(m.lp.find((l) => l.side === 'self')?.value).toBe(6400);
    expect(m.lp.find((l) => l.side === 'opp')?.value).toBe(5200);
    const pile = (side: 'self' | 'opp', kind: string) =>
      m.piles.find((p) => p.side === side && p.kind === kind)?.count;
    expect(pile('self', 'deck')).toBe(27);
    expect(pile('opp', 'deck')).toBe(24);
    expect(pile('self', 'graveyard')).toBe(2);
    expect(pile('opp', 'graveyard')).toBe(1);
    expect(m.phase.turnCount).toBe(4);
    expect(m.phase.phaseLabel).toBe(strings.phase.Main1);
    expect(m.phase.turnOwner).toBe('self');
  });

  it('captions the viewer side "Bạn" and the other side "Đối thủ"', () => {
    const m = model('midgame');
    expect(m.lp.find((l) => l.side === 'self')?.caption).toBe(strings.you);
    expect(m.lp.find((l) => l.side === 'opp')?.caption).toBe(strings.opponent);
  });

  it('LP ratio is against the starting LP and clamped to 0..1', () => {
    const m = model('midgame');
    expect(m.lp.find((l) => l.side === 'self')?.ratio).toBeCloseTo(0.8);
    expect(model('gameover').lp.find((l) => l.side === 'opp')?.ratio).toBe(0);
  });

  it('draws the viewer at the bottom: viewer 1 gets self = seat 1', () => {
    const f = loadFixture('midgame');
    const flipped: StateView = {
      ...f.view,
      viewerIndex: 1,
      turnPlayerIndex: 0,
      players: [f.view.players[1], f.view.players[0]] as unknown as StateView['players'],
    };
    const m = present(flipped, [], { lookup });
    // `players` is indexed by seat, so with viewer 1 the (swapped) seat 1 entry is what "self" reads.
    expect(m.lp.find((l) => l.side === 'self')?.value).toBe(6400);
    expect(m.phase.turnOwner).toBe('opp');
  });
});

describe('present: cards', () => {
  const m = model('midgame');
  const card = (id: string) => m.cards.find((c) => c.id === id)!;

  it('draws the opponent hand as face-down backs, one per card, at the top', () => {
    const hand = m.cards.filter((c) => c.side === 'opp' && c.zone === 'hand');
    expect(hand).toHaveLength(5);
    for (const c of hand) {
      expect(c.faceDown).toBe(true);
      expect(c.label).toBeNull();
      expect(c.detail).toBeNull();
      expect(c.frame).toBeNull();
    }
  });

  it('shows the viewer hand face up with name, level and ATK/DEF', () => {
    const hand = m.cards.filter((c) => c.side === 'self' && c.zone === 'hand');
    expect(hand).toHaveLength(4);
    expect(hand.every((c) => !c.faceDown && c.label !== null)).toBe(true);
    const monster = hand.find((c) => c.label?.name === byId.get('SMP-004')!.name.vi)!;
    expect(monster.frame).toBe('monster');
    expect(monster.label?.atk).not.toBeNull();
    expect(hand.find((c) => c.frame === 'spell')?.label?.atk).toBeNull();
    expect(hand.find((c) => c.frame === 'trap')).toBeDefined();
  });

  it('draws Defense sideways and a face-down monster as a back', () => {
    expect(card('p0-10').defense).toBe(false);
    expect(card('p0-12').defense).toBe(true);
    expect(card('p0-12').faceDown).toBe(false);
    const set = card('p0-11');
    expect(set.faceDown).toBe(true);
    expect(set.defense).toBe(true);
    expect(set.label).toBeNull();
    // the owner knows their own face-down card, so the detail panel can name it
    expect(set.detail?.name).toBe(byId.get('SMP-003')!.name.vi);
  });

  it('draws the opponent face-down monster as a back with no name and no detail', () => {
    const c = card('p1-11');
    expect(c.faceDown).toBe(true);
    expect(c.label).toBeNull();
    expect(c.detail).toBeNull();
  });

  it('puts monsters into the zone rect of their index', () => {
    const layoutX = card('p0-10').rect.x;
    expect(card('p0-12').rect.x).toBeGreaterThan(layoutX);
    expect(card('p1-10').rect.y).toBeLessThan(card('p0-10').rect.y);
  });

  it('treats an opponent face-down card as hidden even if the server wrongly sent it visible', () => {
    const f = loadFixture('midgame');
    const opp = f.view.players[1];
    const leaky: StateView = {
      ...f.view,
      players: [
        f.view.players[0],
        {
          ...opp,
          board: {
            ...opp.board,
            monsterZones: [
              null,
              null,
              {
                hidden: false,
                instanceId: 'leak',
                definitionId: 'SMP-002',
                ownerIndex: 1,
                position: 'DefenseDown',
              },
              null,
              null,
            ],
          },
        },
      ],
    };
    const c = present(leaky, [], { lookup }).cards.find((x) => x.id === 'leak')!;
    expect(c.faceDown).toBe(true);
    expect(c.label).toBeNull();
    expect(c.detail).toBeNull();
    expect(JSON.stringify(c)).not.toContain(byId.get('SMP-002')!.name.vi);
  });
});

describe('present: buttons follow legalActions', () => {
  it('enables next phase / end turn / surrender only when the server lists them', () => {
    const m = model('midgame');
    expect(m.buttons.map((b) => [b.id, b.enabled])).toEqual([
      ['nextPhase', true],
      ['endTurn', true],
      ['surrender', true],
    ]);
    const f = loadFixture('midgame');
    const none = present(f.view, [], { lookup });
    expect(none.buttons.every((b) => !b.enabled && b.action === null)).toBe(true);
    const onlySurrender = present(f.view, [f.legalActions[1]!], { lookup });
    expect(onlySurrender.buttons.map((b) => b.enabled)).toEqual([false, false, true]);
  });

  it('ignores a legal action that belongs to the other seat', () => {
    const f = loadFixture('midgame');
    const other: PlayerAction = { type: 'EndPhase', payload: { playerIndex: 1 } };
    const m = present(f.view, [other], { lookup });
    expect(m.buttons.find((b) => b.id === 'nextPhase')?.enabled).toBe(false);
  });

  it('attaches the very action from legalActions', () => {
    const f = loadFixture('midgame');
    const m = present(f.view, f.legalActions, { lookup });
    expect(m.buttons.find((b) => b.id === 'nextPhase')?.action).toBe(f.legalActions[0]);
  });

  it('asks for confirmation after the first Surrender press', () => {
    expect(model('midgame').buttons.find((b) => b.id === 'surrender')?.label).toBe(
      strings.surrender,
    );
    expect(model('midgame', true).buttons.find((b) => b.id === 'surrender')?.label).toBe(
      strings.surrenderConfirm,
    );
  });

  it('disables everything and shows a banner once the duel is over', () => {
    const m = model('gameover');
    expect(m.buttons.every((b) => !b.enabled)).toBe(true);
    expect(m.banner).toEqual({ kind: 'win', text: strings.win });
    expect(model('midgame').banner).toBeNull();
  });
});

describe('present: hand-limit prompt', () => {
  it('makes each hand card clickable with its own one-card answer, and highlights it', () => {
    const f = loadFixture('handfull');
    const m = present(f.view, f.legalActions, { lookup });
    const hand = m.cards.filter((c) => c.side === 'self' && c.zone === 'hand');
    expect(hand).toHaveLength(7);
    for (const c of hand) {
      expect(c.highlight).toBe(true);
      expect(c.action).toMatchObject({
        type: 'ResolvePendingPrompt',
        payload: { cardInstanceIds: [c.id] },
      });
    }
    expect(m.prompt?.text).toBe(strings.discardPrompt);
    expect(m.buttons.find((b) => b.id === 'nextPhase')?.enabled).toBe(false);
  });

  it('does not highlight or attach actions without a prompt', () => {
    const m = model('midgame');
    expect(m.cards.every((c) => c.action === null && !c.highlight)).toBe(true);
    expect(m.prompt).toBeNull();
  });
});

describe('information leaks', () => {
  /** What the server knows about seat 1's hidden cards; none of it may appear in what viewer 0 renders. */
  const SECRET_DEFS = ['SMP-011', 'SMP-012', 'SMP-013'] as const;
  const secretTokens = SECRET_DEFS.flatMap((id) => [id, byId.get(id)!.name]);

  it.each(FIXTURE_NAMES)('render model of %s carries no hidden card identity', (name) => {
    const f = loadFixture(name);
    const json = JSON.stringify(present(f.view, f.legalActions, { lookup }));
    for (const token of secretTokens) expect(json).not.toContain(token);
    // the model never carries a raw definitionId at all
    expect(json).not.toMatch(/SMP-\d{3}/);
    const hiddenIds = f.view.players
      .flatMap((p) => [...p.hand, ...p.board.monsterZones.filter((c) => c !== null)])
      .filter((c) => c.hidden)
      .map((c) => c.instanceId);
    const m = present(f.view, f.legalActions, { lookup });
    for (const id of hiddenIds) {
      const c = m.cards.find((x) => x.id === id)!;
      expect([c.faceDown, c.label, c.detail, c.frame]).toEqual([true, null, null, null]);
    }
  });

  it('a hidden card that would be named by an id table stays anonymous', () => {
    // A server-side truth table maps hidden instances to real cards; the view given to the client has none of it.
    const truth: Record<string, string> = {
      'p1-h1': 'SMP-011',
      'p1-h2': 'SMP-012',
      'p1-11': 'SMP-013',
    };
    const f = loadFixture('midgame');
    const m = present(f.view, f.legalActions, { lookup });
    for (const id of Object.keys(truth)) {
      const c = m.cards.find((x) => x.id === id)!;
      expect(JSON.stringify(c)).not.toContain(truth[id]!);
      expect(JSON.stringify(c)).not.toContain(byId.get(truth[id]!)!.name);
    }
  });
});
