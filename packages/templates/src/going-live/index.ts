import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Going Live — the pre-roll: a ring counts 3…2…1 down, then flips to a pulsing
// LIVE badge with the stream title. The card you leave up while people arrive.
//
// `countdown-ring` (openers) is a generic timer. This one has a *turn*: the
// countdown is the setup and the LIVE state is the payoff, and the two share
// the same ring, which is what makes the switch land.
//
// The digits are drawn from a pure `update(t)` so scrubbing lands on the exact
// same number every time.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "live", name: "Live", colors: { background: "#141519", textColor: "#F6F6F8", accent: "#EF4444" } },
  { id: "violet", name: "Violet", colors: { background: "#150F1C", textColor: "#F3EFF9", accent: "#A855F7" } },
  { id: "teal", name: "Teal", colors: { background: "#0B1719", textColor: "#E9F7F7", accent: "#14B8A6" } },
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#15161A", accent: "#E11D48" } },
];

interface Layout {
  ringFrac: number;
  titleFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { ringFrac: 0.24, titleFrac: 0.046, centerFrac: 0.44 };
    case "9:16":
      return { ringFrac: 0.44, titleFrac: 0.058, centerFrac: 0.42 };
    case "4:5":
      return { ringFrac: 0.42, titleFrac: 0.054, centerFrac: 0.43 };
    case "1:1":
    default:
      return { ringFrac: 0.42, titleFrac: 0.054, centerFrac: 0.43 };
  }
}

const START_AT = 0.4;
const PER_TICK = 0.85;

function durationFor(from: number): number {
  return START_AT + Math.max(1, from) * PER_TICK + 2.4;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#141519"));
  const textColor = str(values.textColor, pc("textColor", "#F6F6F8"));
  const accent = str(values.accent, pc("accent", "#EF4444"));
  const title = str(values.title, "Portfolio reviews");
  const handle = str(values.handle, "").trim();
  const from = Math.round(Math.max(1, Math.min(9, num(values.from, 3))));
  const showRing = on(values.showRing);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const R = Math.min(size.width, size.height) * L.ringFrac * 0.5;
  const titleSize = Math.round(size.width * L.titleFrac);
  const duration = durationFor(from);
  const liveAt = START_AT + from * PER_TICK;

  const timeline = new JimaTimeline();

  // --- Ring: a static track plus a sweep that empties once per tick ---
  const ringW = Math.max(5, R * 0.075);
  if (showRing) {
    root.addChild(
      (() => {
        const g = new Graphics().circle(0, 0, R).stroke({ color: textColor, width: ringW, alpha: 0.16 });
        g.position.set(cx, cy);
        return g;
      })(),
    );
  }

  // The sweep is 24 short arcs whose alpha is driven from `update` — a stroked
  // arc cannot be partially drawn without rebuilding geometry each frame, and
  // rebuilding geometry every frame is exactly what determinism does not need.
  const segs: Graphics[] = [];
  const segCount = 36;
  if (showRing) {
    for (let i = 0; i < segCount; i++) {
      const a0 = -Math.PI / 2 + (Math.PI * 2 * i) / segCount;
      const a1 = a0 + (Math.PI * 2) / segCount + 0.006;
      const pts: number[] = [];
      for (let k = 0; k <= 4; k++) {
        const a = a0 + (a1 - a0) * (k / 4);
        pts.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      }
      const g = new Graphics().poly(pts, false).stroke({ color: accent, width: ringW, cap: "butt" });
      root.addChild(g);
      segs.push(g);
    }
  }

  // --- The number ---
  const digit = makeText(fonts, {
    text: String(from),
    role: "display",
    weight: 800,
    size: R * 1.15,
    color: textColor,
    anchor: 0.5,
  });
  digit.position.set(cx, cy);
  root.addChild(digit);

  // --- The LIVE badge that replaces it ---
  const badge = new Container();
  badge.position.set(cx, cy);
  root.addChild(badge);
  const liveSize = R * 0.42;
  const liveText = makeText(fonts, {
    text: "LIVE",
    role: "display",
    weight: 800,
    size: liveSize,
    color: bg,
    anchor: 0.5,
    letterSpacing: liveSize * 0.1,
  });
  const dotR = liveSize * 0.22;
  const pw = liveText.width + liveSize * 2.6;
  const ph = liveSize * 2;
  badge.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill(accent));
  const dot = new Graphics().circle(0, 0, dotR).fill(bg);
  dot.position.set(-pw / 2 + liveSize * 0.95, 0);
  badge.addChild(dot);
  liveText.x = liveSize * 0.42;
  badge.addChild(liveText);
  badge.scale.set(0);
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: liveAt, duration: 0.55, ease: outBack })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: liveAt, duration: 0.55, ease: outBack });

  // --- Title & handle, arriving with the badge ---
  const titleY = cy + R * 1.5;
  const t = makeText(fonts, {
    text: title,
    role: "display",
    weight: 800,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
  });
  const maxW = size.width * 0.84;
  if (t.width > maxW) t.scale.set(maxW / t.width);
  t.position.set(cx, titleY);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: liveAt + 0.2, duration: 0.45, ease: outQuad })
    .to(t, { prop: "y", from: titleY + titleSize * 0.4, to: titleY, start: liveAt + 0.2, duration: 0.8, ease: outExpo });

  if (handle.length > 0) {
    const hSize = Math.round(titleSize * 0.5);
    const hy = titleY + titleSize * 1.0;
    const hh = makeText(fonts, { text: handle, role: "body", weight: 600, size: hSize, color: textColor, anchor: 0.5 });
    hh.alpha = 0;
    hh.position.set(cx, hy);
    root.addChild(hh);
    timeline.to(hh, { prop: "alpha", from: 0, to: 0.66, start: liveAt + 0.4, duration: 0.5, ease: outQuad });
  }

  const update = (time: number): void => {
    const counting = time < liveAt;
    // Which number, and how far through its second.
    const idx = Math.floor(Math.max(0, time - START_AT) / PER_TICK);
    const frac = Math.max(0, Math.min(1, (time - START_AT - idx * PER_TICK) / PER_TICK));
    const value = Math.max(1, from - idx);

    digit.text = String(value);
    digit.alpha = counting ? 1 : 0;
    // Each digit lands big and settles — the tick you can feel.
    const settle = Math.min(1, frac / 0.35);
    const e = 1 - Math.pow(1 - settle, 3);
    digit.scale.set(counting ? 1.3 - 0.3 * e : 1);

    if (segs.length) {
      for (let i = 0; i < segs.length; i++) {
        const segFrac = (i + 1) / segs.length;
        // Counting: the ring empties clockwise. Live: it holds full and pulses.
        segs[i]!.alpha = counting ? (segFrac > frac ? 1 : 0) : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((time - liveAt) * 4.2));
      }
    }
  };
  update(0);

  return { timeline, duration, update };
}

export const goingLive: TemplateDefinition = {
  id: "going-live",
  name: "Going Live",
  tagline: "A ring counts down, then flips to a pulsing LIVE badge with your stream title.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 4.4,
  fontRoles: { title: "display", handle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Stream title", default: "Portfolio reviews", maxLength: 40, shrinkToFit: true },
    { key: "handle", type: "text", label: "Handle", default: "@fika.studio", maxLength: 28, optional: true },
    { key: "from", type: "slider", label: "Count from", default: 3, min: 1, max: 9, step: 1 },
    { key: "showRing", type: "toggle", label: "Countdown ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Live colour", default: "", optional: true },
  ],
  estimateDuration: (v) => durationFor(num(v.from, 3)),
  build,
};
