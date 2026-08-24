// Font registry — maps template font *roles* to concrete families/weights,
// loads faces before render/export, and measures text for fitting.
//
// Critical gotcha (CLAUDE.md pitfalls): document.fonts.ready does NOT fetch
// unused faces. We must `document.fonts.load('<weight> <size> <family>', text)`
// per family+weight before drawing, or the first frame renders a fallback font.

export type FontRole = "display" | "body" | "serif" | "mono" | "script";

export interface FontFaceSpec {
  family: string;
  weights: number[];
}

export interface MeasureStyle {
  family: string;
  weight: number;
  size: number;
  letterSpacing?: number;
}

/**
 * Emoji fallback chain, appended after every role's own family.
 *
 * The template families are Latin webfonts with no emoji coverage at all, so an
 * emoji in a headline resolves through this list instead. The system colour
 * fonts come first — a user who types 😂 wants the yellow face their phone
 * shows, not a monochrome outline — and Jima's own shipped **Noto Emoji** is
 * last, purely so a machine with no emoji font at all draws a glyph rather than
 * tofu. Because it is last and Fontsource splits it by unicode-range, the
 * browser never fetches a byte of it on a machine that has colour emoji.
 */
const EMOJI_FALLBACKS = [
  "Apple Color Emoji",
  "Segoe UI Emoji",
  "Noto Color Emoji",
  "Segoe UI Symbol",
  "Noto Emoji",
];

/** The family plus the emoji fallbacks, as a CSS font-family list. */
export function withEmojiFallback(family: string): string {
  return [family, ...EMOJI_FALLBACKS].map((f) => `"${f}"`).join(", ");
}

function cssFont(weight: number, size: number, family: string): string {
  // `family` may already be a quoted stack (see withEmojiFallback); only wrap a
  // bare name. Quoting is for multi-word families like "Space Grotesk".
  const list = family.includes('"') ? family : `"${family}"`;
  return `${weight} ${size}px ${list}`;
}

export class FontRegistry {
  private roles = new Map<FontRole, FontFaceSpec>();
  private measureCtx: CanvasRenderingContext2D | null = null;

  register(role: FontRole, spec: FontFaceSpec): this {
    this.roles.set(role, spec);
    return this;
  }

  spec(role: FontRole): FontFaceSpec {
    const s = this.roles.get(role);
    if (!s) throw new Error(`FontRegistry: role "${role}" is not registered`);
    return s;
  }

  /**
   * The CSS font-family list for a role — the registered family plus the emoji
   * fallbacks. This is what both Pixi and the measuring canvas get, so text
   * measures against exactly the faces it will be painted with.
   */
  family(role: FontRole): string {
    return withEmojiFallback(this.spec(role).family);
  }

  /** The bare registered family name, for loading and `check()`. */
  familyName(role: FontRole): string {
    return this.spec(role).family;
  }

  /** Load one family+weight (idempotent; resolves when the face is usable). */
  async ensure(family: string, weight: number): Promise<void> {
    if (typeof document === "undefined" || !document.fonts) return;
    const spec = cssFont(weight, 64, family);
    try {
      await document.fonts.load(spec, "AaBbGg0123 äöüß");
    } catch {
      // Non-fatal: fall through; check() below will report reality.
    }
  }

  /**
   * Make sure emoji in `text` can be painted, loading Jima's shipped Noto Emoji
   * only if the platform cannot draw them itself.
   *
   * Emoji resolve through the fallback chain, and on every normal device the
   * platform's colour font wins — so the shipped face is dead weight there and
   * must not be fetched. The probe is the standard one: compare the rendered
   * width of an emoji against a codepoint that is guaranteed to be missing
   * everywhere. Equal widths means both drew the same "no glyph" box.
   */
  async ensureEmoji(text: string): Promise<void> {
    if (typeof document === "undefined" || !document.fonts) return;
    const emoji = [...text].filter((ch) => ch.codePointAt(0)! > 0x2000).join("");
    if (emoji.length === 0) return;
    if (this.platformDrawsEmoji()) return;
    try {
      // The second argument restricts the load to the characters actually used,
      // so only the unicode-range subsets that matter are fetched.
      await document.fonts.load(cssFont(400, 64, "Noto Emoji"), emoji);
    } catch {
      /* Non-fatal — worst case the platform's own fallback draws. */
    }
  }

  private emojiSupport: boolean | null = null;

  private platformDrawsEmoji(): boolean {
    if (this.emojiSupport !== null) return this.emojiSupport;
    try {
      const ctx = this.ctx();
      ctx.font = "64px sans-serif";
      const glyph = ctx.measureText("\u{1F600}").width;
      // U+FFFF is a permanent noncharacter — nothing anywhere has a glyph for it.
      const missing = ctx.measureText("\uFFFF").width;
      this.emojiSupport = glyph > 0 && Math.abs(glyph - missing) > 0.5;
    } catch {
      this.emojiSupport = false;
    }
    return this.emojiSupport;
  }

  /** Load every registered role/weight. Call before first render + before export. */
  async ensureAll(): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const { family, weights } of this.roles.values()) {
      for (const w of weights) jobs.push(this.ensure(family, w));
    }
    await Promise.all(jobs);
  }

  /** True once the given face is actually loaded (never renders fallback silently). */
  isLoaded(family: string, weight: number): boolean {
    if (typeof document === "undefined" || !document.fonts) return true;
    return document.fonts.check(cssFont(weight, 64, family));
  }

  private ctx(): CanvasRenderingContext2D {
    if (this.measureCtx) return this.measureCtx;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("FontRegistry: 2D context unavailable for measuring");
    this.measureCtx = ctx;
    return ctx;
  }

  /** Pixel width of `text` at the given style (used by the fit helpers). */
  measure(text: string, style: MeasureStyle): number {
    const ctx = this.ctx();
    ctx.font = cssFont(style.weight, style.size, style.family);
    const base = ctx.measureText(text).width;
    if (style.letterSpacing && text.length > 1) {
      return base + style.letterSpacing * (text.length - 1);
    }
    return base;
  }
}

/**
 * Default registry: display (Space Grotesk), body (Inter), serif (Fraunces),
 * mono (JetBrains Mono).
 */
export function createDefaultFontRegistry(): FontRegistry {
  return new FontRegistry()
    .register("display", { family: "Space Grotesk", weights: [400, 500, 600, 700] })
    // Body carries 700 because a number of templates draw bold captions/labels
    // at that weight; registering it makes `ensureAll` actually preload the face
    // instead of letting the browser synthesize a fake bold on first paint.
    .register("body", { family: "Inter", weights: [400, 500, 600, 700] })
    .register("serif", { family: "Fraunces", weights: [400, 500, 600, 700] })
    .register("mono", { family: "JetBrains Mono", weights: [400, 700] });
}

/**
 * A user-selectable font. `family` must match a loaded @font-face, and `weights`
 * must list only the static instances actually shipped for it — the registry
 * preloads exactly these, and a weight we claim but never loaded would measure
 * against a fallback face while painting with the real one (mismatched fitting).
 *
 * Note for variable fonts: a canvas `font` string cannot express variable axes
 * (CLAUDE.md pitfalls), so every family here is registered as static instances.
 * Parkinsans ships twice in the app — the variable face (family "Parkinsans
 * Variable") drives app chrome, the static faces (family "Parkinsans") below
 * serve the engine.
 */
export interface FontChoice {
  id: string;
  label: string;
  family: string;
  kind: "sans" | "serif" | "mono";
  weights: number[];
}

/** Weights loaded for most families (see apps/web/src/fonts.ts imports). */
const W_FULL = [400, 500, 600, 700];

/**
 * Headline (display-role) fonts offered in the Studio. All OFL-1.1 and
 * self-hosted by the app + render harness, so a swap never renders a fallback.
 * `id` "default" keeps the template's built-in display font (Space Grotesk).
 */
export const FONT_CHOICES: FontChoice[] = [
  { id: "default", label: "Space Grotesk", family: "Space Grotesk", kind: "sans", weights: W_FULL },
  { id: "parkinsans", label: "Parkinsans", family: "Parkinsans", kind: "sans", weights: W_FULL },
  { id: "jakarta", label: "Plus Jakarta Sans", family: "Plus Jakarta Sans", kind: "sans", weights: W_FULL },
  { id: "inter", label: "Inter", family: "Inter", kind: "sans", weights: W_FULL },
  { id: "archivo", label: "Archivo", family: "Archivo", kind: "sans", weights: W_FULL },
  { id: "sora", label: "Sora", family: "Sora", kind: "sans", weights: W_FULL },
  { id: "poppins", label: "Poppins", family: "Poppins", kind: "sans", weights: W_FULL },
  { id: "outfit", label: "Outfit", family: "Outfit", kind: "sans", weights: W_FULL },
  { id: "fraunces", label: "Fraunces", family: "Fraunces", kind: "serif", weights: W_FULL },
  // JetBrains Mono ships only 400/700 — don't claim weights we never loaded.
  { id: "jetbrains", label: "JetBrains Mono", family: "JetBrains Mono", kind: "mono", weights: [400, 700] },
];

/**
 * Body-role fonts (captions, sublines, labels). Same families, but `id`
 * "default" here means the template's built-in body font (Inter).
 */
export const BODY_FONT_CHOICES: FontChoice[] = [
  { id: "default", label: "Inter", family: "Inter", kind: "sans", weights: W_FULL },
  ...FONT_CHOICES.filter((f) => f.id !== "default" && f.id !== "inter"),
];

export function fontChoice(id: string | undefined): FontChoice | undefined {
  return id ? FONT_CHOICES.find((f) => f.id === id) : undefined;
}

export function bodyFontChoice(id: string | undefined): FontChoice | undefined {
  return id ? BODY_FONT_CHOICES.find((f) => f.id === id) : undefined;
}

/**
 * A registry with the "display" (headline) and/or "body" roles optionally
 * swapped to chosen fonts. Serif/mono keep their defaults. Used by the Studio +
 * export so a project's fonts follow the whole template.
 */
export function createFontRegistry(opts?: { headline?: string | undefined; body?: string | undefined }): FontRegistry {
  const reg = createDefaultFontRegistry();
  const h = fontChoice(opts?.headline);
  if (h && h.id !== "default") {
    reg.register("display", { family: h.family, weights: h.weights });
  }
  const b = bodyFontChoice(opts?.body);
  if (b && b.id !== "default") {
    reg.register("body", { family: b.family, weights: b.weights });
  }
  return reg;
}
