// Easing functions — pure `(u: 0..1) => number`, exact endpoints f(0)=0, f(1)=1
// (except intentionally overshooting curves, which still return exactly 0 and 1
// at the endpoints). No wall-clock, no randomness: safe in the determinism zone.

export type EaseFn = (u: number) => number;

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

export const linear: EaseFn = (u) => clamp01(u);

// Power families (quad=2 … quint=5) generated from a single helper.
function power(exp: number): { in: EaseFn; out: EaseFn; inOut: EaseFn } {
  const easeIn: EaseFn = (u) => {
    u = clamp01(u);
    return Math.pow(u, exp);
  };
  const easeOut: EaseFn = (u) => {
    u = clamp01(u);
    return 1 - Math.pow(1 - u, exp);
  };
  const easeInOut: EaseFn = (u) => {
    u = clamp01(u);
    return u < 0.5 ? Math.pow(2, exp - 1) * Math.pow(u, exp) : 1 - Math.pow(-2 * u + 2, exp) / 2;
  };
  return { in: easeIn, out: easeOut, inOut: easeInOut };
}

const quad = power(2);
const cubic = power(3);
const quart = power(4);
const quint = power(5);

export const inQuad = quad.in;
export const outQuad = quad.out;
export const inOutQuad = quad.inOut;
export const inCubic = cubic.in;
export const outCubic = cubic.out;
export const inOutCubic = cubic.inOut;
export const inQuart = quart.in;
export const outQuart = quart.out;
export const inOutQuart = quart.inOut;
export const inQuint = quint.in;
export const outQuint = quint.out;
export const inOutQuint = quint.inOut;

// Exponential.
export const inExpo: EaseFn = (u) => {
  u = clamp01(u);
  return u === 0 ? 0 : Math.pow(2, 10 * u - 10);
};
export const outExpo: EaseFn = (u) => {
  u = clamp01(u);
  return u === 1 ? 1 : 1 - Math.pow(2, -10 * u);
};
export const inOutExpo: EaseFn = (u) => {
  u = clamp01(u);
  if (u === 0) return 0;
  if (u === 1) return 1;
  return u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2;
};

// Back (overshoot). `s` controls the overshoot amount (default 1.70158 = ~10%).
export function makeOutBack(s = 1.70158): EaseFn {
  const c3 = s + 1;
  return (u) => {
    u = clamp01(u);
    if (u === 0) return 0;
    if (u === 1) return 1;
    return 1 + c3 * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
  };
}
export function makeInBack(s = 1.70158): EaseFn {
  const c3 = s + 1;
  return (u) => {
    u = clamp01(u);
    if (u === 0) return 0;
    if (u === 1) return 1;
    return c3 * u * u * u - s * u * u;
  };
}
export const outBack = makeOutBack();
export const inBack = makeInBack();

// Elastic — springy settle with exact endpoints.
export const outElastic: EaseFn = (u) => {
  u = clamp01(u);
  if (u === 0) return 0;
  if (u === 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * c4) + 1;
};

/**
 * spring(damping) — a settling overshoot curve for entrances, exact endpoints.
 * Lower damping = more overshoot/bounce. Implemented as a decaying cosine, then
 * end-corrected so f(1)=1 exactly (keeps golden frames stable at the last frame).
 * Deterministic: pure function of u.
 */
export function spring(damping = 0.5, frequency = 3): EaseFn {
  const d = Math.max(0.05, Math.min(1, damping));
  const raw = (x: number): number => {
    const decay = Math.exp(-d * frequency * Math.PI * x);
    return 1 - decay * Math.cos(frequency * Math.PI * x * (1 - d * 0.5));
  };
  const residual = raw(1) - 1; // correction so the curve lands exactly on 1
  return (u) => {
    u = clamp01(u);
    if (u === 0) return 0;
    if (u === 1) return 1;
    return raw(u) - residual * u;
  };
}

// Stepped (e.g. split-flap / typewriter caret feels). n discrete steps.
export function steps(n: number, jump: "start" | "end" = "end"): EaseFn {
  const count = Math.max(1, Math.floor(n));
  return (u) => {
    u = clamp01(u);
    const stepped = jump === "start" ? Math.ceil(u * count) : Math.floor(u * count);
    return Math.min(1, stepped / count);
  };
}

// Named registry so templates and tests can reference easings by string.
export const EASINGS = {
  linear,
  inQuad,
  outQuad,
  inOutQuad,
  inCubic,
  outCubic,
  inOutCubic,
  inQuart,
  outQuart,
  inOutQuart,
  inQuint,
  outQuint,
  inOutQuint,
  inExpo,
  outExpo,
  inOutExpo,
  inBack,
  outBack,
  outElastic,
} as const satisfies Record<string, EaseFn>;

export type EasingName = keyof typeof EASINGS;
