import { SAMPLE_CARDS } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { formatDetail } from './detail-text';
import { loadFixture } from './fixtures';
import { instanceLabelIn } from './labels';
import { present } from './presenter';
import { strings } from './strings';

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string) => byId.get(id);

describe('formatDetail', () => {
  it('shows name, level, ATK/DEF and position of a known monster', () => {
    const f = loadFixture('midgame');
    const m = present(f.view, f.legalActions, { lookup });
    const text = formatDetail(m.cards.find((c) => c.id === 'p0-10')!.detail);
    const def = byId.get('SMP-001')!;
    expect(text).toContain(def.name.vi);
    expect(text).toContain('Level 3');
    expect(text).toContain('ATK 1200 / DEF 800');
    expect(text).toContain('Thế công');
  });

  it('never names a card the viewer may not know', () => {
    const f = loadFixture('midgame');
    const m = present(f.view, f.legalActions, { lookup });
    const hiddenDetail = m.cards.find((c) => c.id === 'p1-11')!.detail;
    expect(formatDetail(hiddenDetail, true)).toBe(strings.detailHidden);
    expect(formatDetail(null)).toBe(strings.detailEmpty);
  });
});

describe('instanceLabelIn', () => {
  const f = loadFixture('midgame');
  it('names visible cards, and keeps hidden ones anonymous', () => {
    expect(instanceLabelIn(f.view, 'p0-10', lookup)).toBe(byId.get('SMP-001')!.name.vi);
    expect(instanceLabelIn(f.view, 'p1-11', lookup)).toBe('lá ẩn');
    expect(instanceLabelIn(f.view, 'p1-h1', lookup)).toBe('lá ẩn');
    expect(instanceLabelIn(f.view, 'unknown', lookup)).toBe('unknown');
  });
});
