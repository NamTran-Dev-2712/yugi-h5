/**
 * Tiny deterministic PRNG for the AI (mulberry32 over an FNV-1a hash of the seed string). The AI only uses it to
 * break ties, so the same (duel seed, action count) always yields the same choice and replays stay reproducible.
 * Never `Math.random()`. Kept separate from the engine RNG on purpose: the AI must not touch `state.rng`.
 */
export function createAiRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
