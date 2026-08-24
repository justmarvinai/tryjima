import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeRect,
  shrinkToFit,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type EaseFn,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Slow Pan — one oversized hero line makes a single, slow, decelerating pass
// across the frame while a small caption holds perfectly still beside it. The
// pan eases up to a cruise, glides at near-constant speed, then settles to a
// full stop with the closing words framed. Deliberately NOT `ticker-bar` (an
// endless looping marquee strip of many items): this is one line, one pass, and
// it ends parked.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "editorial", name: "Editorial", colors: { background: "#FBFAF7", textColor: "#16181B", accent: "#B8422C" } },
  { id: "dusk", name: "Dusk", colors: { background: "#14161A", textColor: "#F3F2ED", accent: "#E9B44C" } },
  { id: "linen", name: "Linen", colors: { background: "#F0EAE1", textColor: "#221D18", accent: "#8A5A2B" } },
  { id: "steel", name: "Steel", colors: { background: "#E6EAEE", textColor: "#121A22", accent: "#1F4FB8" } },
];

// --- Cinematic pan curve: smooth ramp up, long near-linear cruise, long
// deceleration to a dead stop. Pure f(u) with exact endpoints. ---
const PAN_ACCEL = 0.22;
const PAN_DECEL = 0.42;
const PAN_V = 1 / (1 - (PAN_ACCEL + PAN_DECEL) / 2);
/** Integral of smoothstep(3x^2 - 2x^3) — the eased velocity ramp. */
const rampArea = (x: number): number => x * x * x - (x * x * x * x) / 2;
const panEase: EaseFn = (u) => {
  const x = u < 0 ? 0 : u > 1 ? 1 : u;
  if (x < PAN_ACCEL) return PAN_V * PAN_ACCEL * rampArea(x / PAN_ACCEL);
  if (x > 1 - PAN_DECEL) return 1 - PAN_V * PAN_DECEL * rampArea((1 - x) / PAN_DECEL);
  return PAN_V * (PAN_ACCEL / 2 + (x - PAN_ACCEL));
};

interface Layout {
  /** Target hero width as a fraction of the frame width — near full bleed. */
  widthFrac: number;
  /** Cap on the hero size as a fraction of frame height (short strings). */
  maxSizeFrac: number;
  /** How far the line travels, as a fraction of the frame width. */
  panFrac: number;
  /** Hero centre line as a fraction of the safe rect height. */
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { widthFrac: 0.93, maxSizeFrac: 0.24, panFrac: 0.54, centerFrac: 0.45 };
    case "9:16":
      return { widthFrac: 0.88, maxSizeFrac: 0.12, panFrac: 0.5, centerFrac: 0.46 };
    case "4:5":
      return { widthFrac: 0.9, maxSizeFrac: 0.16, panFrac: 0.5, centerFrac: 0.45 };
    case "1:1":
    default:
      return { widthFrac: 0.9, maxSizeFrac: 0.19, panFrac: 0.5, centerFrac: 0.45 };
  }
}

const RULE_START = 0.25;
const PAN_START = 0.4;
const PAN_DUR = 2.85;
const SUB_START = 0.85;
const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBFAF7"));
  const textColor = str(values.textColor, pc("textColor", "#16181B"));
  const accent = str(values.accent, pc("accent", "#B8422C"));
  const headline = str(values.headline, "Slow is a style").replace(/\s+/g, " ").trim();
  const subline = str(values.subline, "").trim();
  const showRule = on(values.showRule);
  const showMarker = on(values.showMarker);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const safe = safeRect(ctx.aspect);
  const heroCy = safe.y + safe.height * L.centerFrac;

  // --- Size the hero so the line always fills the frame edge to edge, however
  // long the string is: longer copy simply pans at a smaller size. ---
  const family = fonts.family("display");
  const probe = 120;
  const trackFrac = -0.018;
  const probeWidth = Math.max(
    1,
    fonts.measure(headline, { family, weight: 600, size: probe, letterSpacing: probe * trackFrac }),
  );
  const targetW = size.width * L.widthFrac;
  const maxSize = Math.round(size.height * L.maxSizeFrac);
  const minSize = Math.round(size.width * 0.035);
  const heroSize = Math.max(minSize, Math.min(maxSize, Math.round((targetW / probeWidth) * probe)));
  const tracking = heroSize * trackFrac;
  const heroW = fonts.measure(headline, { family, weight: 600, size: heroSize, letterSpacing: tracking });

  const hero = makeText(fonts, {
    text: headline,
    role: "display",
    weight: 600,
    size: heroSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: tracking,
  });

  // The line enters from the right with its tail off-frame and parks dead
  // centre, so the settled end frame reads cleanly at any string length.
  const endX = (size.width - heroW) / 2;
  const startX = endX + size.width * L.panFrac;

  const heroLayer = new Container();
  heroLayer.label = "hero";
  root.addChild(heroLayer);
  hero.position.set(startX, heroCy);
  hero.alpha = 0;
  heroLayer.addChild(hero);

  const timeline = new JimaTimeline();
  timeline
    .to(hero, { prop: "alpha", from: 0, to: 1, start: PAN_START, duration: 0.7, ease: outQuad })
    .to(hero, { prop: "x", from: startX, to: endX, start: PAN_START, duration: PAN_DUR, ease: panEase });

  // --- Everything below holds absolutely still: the stillness is what makes
  // the pan read as deliberate rather than as drift. ---
  const ruleY = heroCy + heroSize * 0.72;
  const ruleH = Math.max(2, Math.round(size.width * 0.0015));
  if (showRule) {
    const rule = new Graphics().roundRect(0, -ruleH / 2, safe.width, ruleH, ruleH / 2).fill(textColor);
    rule.position.set(safe.x, ruleY);
    rule.alpha = 0.22;
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: RULE_START, duration: 0.95, ease: outExpo });
  }

  if (subline.length > 0) {
    const bodyFamily = fonts.family("body");
    const base = Math.round(heroSize * 0.19);
    const markerW = showMarker ? Math.max(6, Math.round(base * 0.5)) : 0;
    const gap = showMarker ? base * 0.62 : 0;
    const subMax = safe.width - markerW - gap;
    const subSize = shrinkToFit(
      subline,
      (s, sz) => fonts.measure(s, { family: bodyFamily, weight: 500, size: sz, letterSpacing: sz * 0.08 }),
      { maxWidth: subMax, baseSize: base, minSize: Math.round(base * 0.55) },
    );
    const subY = ruleY + heroSize * 0.34;
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: subSize * 0.08,
    });
    sub.position.set(safe.x + markerW + gap, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.7, start: SUB_START, duration: 0.7, ease: outQuad })
      .to(sub, { prop: "x", from: safe.x + markerW + gap + heroSize * 0.06, to: safe.x + markerW + gap, start: SUB_START, duration: 0.85, ease: outQuint });

    if (showMarker) {
      const marker = new Graphics().roundRect(0, -markerW / 2, markerW, markerW, markerW * 0.24).fill(accent);
      marker.position.set(safe.x, subY);
      marker.alpha = 0;
      marker.scale.set(0.5);
      root.addChild(marker);
      timeline
        .to(marker, { prop: "alpha", from: 0, to: 1, start: SUB_START - 0.15, duration: 0.45, ease: outQuad })
        .to(marker, { prop: "scale.x", from: 0.5, to: 1, start: SUB_START - 0.15, duration: 0.75, ease: outExpo })
        .to(marker, { prop: "scale.y", from: 0.5, to: 1, start: SUB_START - 0.15, duration: 0.75, ease: outExpo });
    }
  }

  return { timeline, duration: DURATION };
}

export const slowPanType: TemplateDefinition = {
  id: "slow-pan-type",
  name: "Slow Pan",
  tagline: "An oversized headline makes one slow, cinematic pass and parks.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.1,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Slow is a style", maxLength: 42, shrinkToFit: true },
    { key: "subline", type: "text", label: "Caption", default: "One line, one pass", maxLength: 60, optional: true },
    { key: "showRule", type: "toggle", label: "Baseline rule", default: true },
    { key: "showMarker", type: "toggle", label: "Accent marker", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
