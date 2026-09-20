/**
 * Deterministic PRNG (mulberry32). GameState carries the RNG's numeric state
 * so the whole engine stays serializable/replayable from (seed + action log) —
 * never reach for Math.random()/Date.now() anywhere in this package.
 */
export interface RngState {
  readonly state: number;
}

function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: string | number): RngState {
  return { state: hashSeed(seed) || 1 };
}

/** Returns a float in [0, 1) plus the next RNG state. */
export function nextFloat(rng: RngState): [value: number, next: RngState] {
  let t = (rng.state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { state: t >>> 0 }];
}

/** Returns an integer in [0, maxExclusive) plus the next RNG state. */
export function nextInt(rng: RngState, maxExclusive: number): [value: number, next: RngState] {
  const [f, next] = nextFloat(rng);
  return [Math.floor(f * maxExclusive), next];
}

/** Fisher-Yates shuffle, returns a new array plus the next RNG state. Never mutates the input. */
export function shuffle<T>(rng: RngState, items: readonly T[]): [shuffled: T[], next: RngState] {
  const result = [...items];
  let current = rng;
  for (let i = result.length - 1; i > 0; i--) {
    const [j, next] = nextInt(current, i + 1);
    current = next;
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return [result, current];
}
