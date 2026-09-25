import { describe, expect, it } from 'vitest';
import { parseScenarioText, sampleList } from './sandbox-load';

const valid = {
  name: 'demo',
  seed: 's',
  players: [
    {
      lp: 8000,
      hand: ['SMP-001'],
      deck: ['SMP-002'],
      field: { monsters: [], spellTraps: [] },
      gy: [],
    },
    { lp: 8000, hand: [], deck: ['SMP-002'], field: { monsters: [], spellTraps: [] }, gy: [] },
  ],
  turn: { count: 1, player: 0 },
  phase: 'Main1',
};

describe('parseScenarioText', () => {
  it('accepts a valid scenario and returns the parsed object', () => {
    const r = parseScenarioText(JSON.stringify(valid));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scenario.name).toBe('demo');
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseScenarioText(`\n  ${JSON.stringify(valid)}  \n`).ok).toBe(true);
  });

  it('reports empty input', () => {
    const r = parseScenarioText('   ');
    expect(r).toEqual({ ok: false, errors: ['Chưa có JSON để nạp.'] });
  });

  it('reports a JSON syntax error with its message', () => {
    const r = parseScenarioText('{ "name": ');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]).toMatch(/^JSON không hợp lệ: /);
    }
  });

  it('lists every schema problem with its path', () => {
    const bad = { ...valid, phase: 'Nope', players: [valid.players[0]] };
    const r = parseScenarioText(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith('phase: '))).toBe(true);
      expect(r.errors.some((e) => e.startsWith('players: '))).toBe(true);
    }
  });

  it('rejects unknown keys (typos are not silently dropped)', () => {
    const r = parseScenarioText(JSON.stringify({ ...valid, phasee: 'Main1' }));
    expect(r.ok).toBe(false);
  });

  it('does not accept a JSON array or a bare value', () => {
    expect(parseScenarioText('[]').ok).toBe(false);
    expect(parseScenarioText('42').ok).toBe(false);
  });
});

describe('sampleList', () => {
  it('names each sample after its file and sorts them', () => {
    const list = sampleList({
      '../x/tribute-summon.json': '{"a":1}',
      '../x/attack-defense.json': '{"b":2}',
    });
    expect(list.map((s) => s.name)).toEqual(['attack-defense', 'tribute-summon']);
    expect(list[0]?.text).toBe('{"b":2}');
  });

  it('is empty for no samples', () => {
    expect(sampleList({})).toEqual([]);
  });
});
