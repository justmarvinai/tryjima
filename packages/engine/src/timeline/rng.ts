// Seeded deterministic RNG. The ONLY source of randomness allowed in the engine
// and templates (Math.random is lint-banned — CLAUDE.md rule 6). Same seed →
// identical sequence, so golden frames stay stable.

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Pick an element (stable for a given call order). */
  pick<T>(items: readonly T[]): T;
  /** A fresh independent stream derived from this one (for per-particle seeds). */
  fork(salt: number): Rng;
}

/** mulberry32 — tiny, fast, well-distributed 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const gen = mulberry32(seed);
  const rng: Rng = {
    next: () => gen(),
    range: (min, max) => min + gen() * (max - min),
    int: (min, max) => min + Math.floor(gen() * (max - min + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error("createRng.pick: empty array");
      const idx = Math.floor(gen() * items.length);
      // idx is in [0, length) by construction; the ?? keeps TS happy under
      // noUncheckedIndexedAccess without a non-null assertion.
      return items[idx] ?? items[items.length - 1]!;
    },
    fork: (salt) => createRng((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0),
  };
  return rng;
}
