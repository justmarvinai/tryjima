import { describe, it, expect } from "vitest";
import { createRng, mulberry32 } from "./rng";

describe("seeded RNG", () => {
  it("same seed → identical sequence", () => {
    const a = Array.from({ length: 20 }, mulberry32(42) as () => number);
    const b = Array.from({ length: 20 }, mulberry32(42) as () => number);
    expect(a).toEqual(b);
  });

  it("different seeds → different sequences", () => {
    const a = createRng(1).next();
    const b = createRng(2).next();
    expect(a).not.toBe(b);
  });

  it("next() stays within [0,1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() is inclusive on both ends and in range", () => {
    const rng = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    expect(seen.has(1)).toBe(true);
    expect(seen.has(6)).toBe(true);
  });

  it("pick() returns an element and throws on empty", () => {
    const rng = createRng(3);
    expect(["a", "b", "c"]).toContain(rng.pick(["a", "b", "c"]));
    expect(() => rng.pick([])).toThrow();
  });

  it("fork() is deterministic but independent from the parent stream", () => {
    const parent1 = createRng(5);
    const parent2 = createRng(5);
    const f1 = parent1.fork(2).next();
    const f2 = parent2.fork(2).next();
    expect(f1).toBe(f2); // deterministic
    expect(parent1.fork(2).next()).not.toBe(parent1.fork(3).next()); // salt matters
  });
});
