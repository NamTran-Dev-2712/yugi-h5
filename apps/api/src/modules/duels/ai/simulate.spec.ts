import { describe, expect, it } from 'vitest';
import { chooseAction, type AiPolicy } from './choose-action';
import { randomPolicy, simulate, summarize, type SimResult } from './simulate';

/**
 * Suite size. A game costs seconds (every step recomputes legalActions by dry-running the engine), so the default is
 * small. Long version, split over processes: `AI_SIM_GAMES=50 AI_SIM_OFFSET=0|50|100|150 pnpm --filter @yugi/api exec vitest run simulate`.
 */
const GAMES = Number(process.env['AI_SIM_GAMES'] ?? 3);
const OFFSET = Number(process.env['AI_SIM_OFFSET'] ?? 0);

const fmt = (n: number) => n.toFixed(1);

/** Property: on every state reached in these games the AI answers with one of the legal actions, never Surrender. */
let checkedCalls = 0;
const checked: AiPolicy = (input) => {
  const answer = chooseAction(input);
  const key = JSON.stringify(answer);
  if (!input.legalActions.some((a) => JSON.stringify(a) === key)) {
    throw new Error(`AI answered outside legalActions: ${key}`);
  }
  if (answer.type === 'Surrender') throw new Error('AI surrendered');
  checkedCalls++;
  return answer;
};

describe('AI vs AI simulation', () => {
  it('every game finishes, nothing is rejected, nobody surrenders', () => {
    const results: SimResult[] = [];
    for (let i = OFFSET; i < OFFSET + GAMES; i++) {
      results.push(simulate({ seed: `aa-${i}`, policies: [checked, checked] }));
    }
    const s = summarize(results);
    console.info(
      `[AI vs AI] games=${s.games} meanTurns=${fmt(s.meanTurns)} meanActions=${fmt(s.meanActions)} ` +
        `seat0Wins=${s.seatWins[0]} seat1Wins=${s.seatWins[1]} draws=${s.draws}`,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.rejected, 'actions the engine refused').toBe(0);
    expect(s.surrenders).toBe(0);
    expect(s.finished).toBe(s.games);
    expect(checkedCalls).toBeGreaterThan(s.games * 50);
  }, 600_000);
});

describe('AI strength', () => {
  it('beats a uniformly random legal-action player by a wide margin (seats alternated)', () => {
    let aiWins = 0;
    let randomWins = 0;
    const results: SimResult[] = [];
    for (let i = OFFSET; i < OFFSET + GAMES; i++) {
      const aiSeat = (i % 2) as 0 | 1;
      const policies = aiSeat === 0 ? [checked, randomPolicy] : [randomPolicy, checked];
      const r = simulate({ seed: `ar-${i}`, policies: [policies[0]!, policies[1]!] });
      results.push(r);
      if (r.winner === aiSeat) aiWins++;
      else if (r.winner === 0 || r.winner === 1) randomWins++;
    }
    const s = summarize(results);
    const decided = aiWins + randomWins;
    const rate = decided === 0 ? 0 : aiWins / decided;
    console.info(
      `[AI vs random] games=${s.games} aiWins=${aiWins} randomWins=${randomWins} ` +
        `winRate=${(rate * 100).toFixed(1)}% meanTurns=${fmt(s.meanTurns)} stuck=${s.stuck} rejected=${s.rejected}`,
    );
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(rate).toBeGreaterThanOrEqual(0.7);
  }, 600_000);
});
