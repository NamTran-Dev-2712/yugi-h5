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

  it('a Field / Continuous card in force says so instead of a battle position (task 4.3b)', () => {
    const f = loadFixture('field-active');
    const m = present(f.view, f.legalActions, { lookup });
    for (const id of ['p0-30', 'p0-31', 'p0-32']) {
      const text = formatDetail(m.cards.find((c) => c.id === id)!.detail);
      expect(text, id).toContain('Đang có hiệu lực trên sân');
      expect(text, id).not.toContain('Thế công');
    }
    // My Set copy is not in force; a monster keeps its position line.
    expect(formatDetail(m.cards.find((c) => c.id === 'p0-33')!.detail)).not.toContain(
      'Đang có hiệu lực',
    );
    const monster = formatDetail(m.cards.find((c) => c.id === 'p0-10')!.detail);
    expect(monster).toContain('Thế công');
    expect(monster).toContain('ATK 2500 / DEF 900');
    expect(monster).toContain('(chỉ số in: ATK 1600 / DEF 900)');
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
