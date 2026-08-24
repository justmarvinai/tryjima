import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// A drawn sneaker built from four stacked parts pulls apart into an exploded
// diagram with leader lines, then snaps back together for the hold. The
// separate/reassemble mechanic is the point — spec-callouts never moves parts.
const DEFAULT_LABELS = ["Padded collar", "Knit upper", "Cloud midsole", "Grip outsole"];

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", textColor: "#14140F", muted: "#8A8A7E", accent: "#FF4D1C", bodyColor: "#2A2C33", midColor: "#FFFFFF", soleColor: "#14140F" } },
  { id: "court-blue", name: "Court blue", colors: { background: "#E9F1FC", textColor: "#0B1A2E", muted: "#7A8AA0", accent: "#1E6FE0", bodyColor: "#274690", midColor: "#FFFFFF", soleColor: "#0B1A2E" } },
  { id: "sand-trail", name: "Sand trail", colors: { background: "#F6EFE3", textColor: "#2E2113", muted: "#9A8C74", accent: "#C2481B", bodyColor: "#6B4A2B", midColor: "#FFF9EC", soleColor: "#3A2A18" } },
  { id: "night-drop", name: "Night drop", colors: { background: "#131519", textColor: "#FFFFFF", muted: "#6E7683", accent: "#C7F24A", bodyColor: "#3A3F49", midColor: "#E8EAED", soleColor: "#2E323A" } },
];

const P_IN = 0.15;
const EXPLODE = 0.85;
const EX_STAGGER = 0.09;
const EX_DUR = 0.75;
const ANNOT_IN = 1.95;
const ANNOT_STAGGER = 0.18;
const ANNOT_OUT = 3.35;
const RETURN = 3.6;
const RE_STAGGER = 0.05;
const RE_DUR = 0.55;
const IMPACT = 4.28;
const NAME_IN = 4.25;
const DURATION = 4.8;

interface PartSpec {
  node: Container;
  /** Exploded y-offset (in u units, applied to the container). */
  exp: number;
  /** Leader line y (product coords, u units) at the exploded pose. */
  lineY: number;
  /** Leader line x start near the part edge (u units). */
  lineX: number;
  /** Which side the label sits on. */
  side: 1 | -1;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const muted = pc("muted", "#8A8A7E");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const bodyColor = str(values.bodyColor, pc("bodyColor", "#2A2C33"));
  const midColor = pc("midColor", "#FFFFFF");
  const soleColor = str(values.soleColor, pc("soleColor", "#14140F"));

  const kicker = typeof values.kicker === "string" ? values.kicker : "What's inside";
  const name = str(values.name, "Volt Runner");
  const labels = asList(values.labels, DEFAULT_LABELS).slice(0, 4);
  const showDetails = values.showDetails !== false;
  const showDots = values.showDots !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = W / 2;
  const pcy = zone.y + zone.height * 0.5 - minDim * 0.02;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // Product unit width — everything below is drawn in u units.
  const u = Math.min(minDim * 0.5, zone.width * 0.42);

  // --- Kicker (above the exploded stack) ---
  if (kicker.length > 0) {
    const kSize = fitSize(fonts, kicker, "body", 700, Math.round(minDim * 0.027), zone.width * 0.8);
    const kickerY = pcy - u * 0.605 - minDim * 0.055;
    const kText = makeText(fonts, { text: kicker.toUpperCase(), role: "body", weight: 700, size: kSize, color: muted, anchor: 0.5, letterSpacing: kSize * 0.18 });
    kText.position.set(cx, kickerY);
    kText.alpha = 0;
    root.addChild(kText);
    timeline
      .to(kText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
      .to(kText, { prop: "y", from: kickerY - 12, to: kickerY, start: 0.1, duration: 0.5, ease: outQuint });
  }

  // --- Product container (all four parts drawn in assembled pose) ---
  const P = new Container();
  P.position.set(cx, pcy);
  P.alpha = 0;
  P.scale.set(0.88);
  root.addChild(P);
  timeline
    .to(P, { prop: "alpha", from: 0, to: 1, start: P_IN, duration: 0.35, ease: outQuad })
    .to(P, { prop: "scale.x", from: 0.88, to: 1, start: P_IN, duration: 0.55, ease: makeOutBack(1.6) })
    .to(P, { prop: "scale.y", from: 0.88, to: 1, start: P_IN, duration: 0.55, ease: makeOutBack(1.6) })
    // Anticipation squash right before the explode…
    .to(P, { prop: "scale.y", from: 1, to: 0.965, start: 0.68, duration: 0.14, ease: outQuad })
    .to(P, { prop: "scale.y", from: 0.965, to: 1, start: 0.82, duration: 0.28, ease: makeOutBack(2) })
    // …and an impact squash when the parts slam back together.
    .to(P, { prop: "scale.y", from: 1, to: 0.955, start: IMPACT, duration: 0.08, ease: outQuad })
    .to(P, { prop: "scale.y", from: 0.955, to: 1, start: IMPACT + 0.08, duration: 0.24, ease: makeOutBack(2.4) })
    .to(P, { prop: "scale.x", from: 1, to: 1.03, start: IMPACT, duration: 0.08, ease: outQuad })
    .to(P, { prop: "scale.x", from: 1.03, to: 1, start: IMPACT + 0.08, duration: 0.24, ease: makeOutBack(2.4) });

  const detailInk = { color: bg, alpha: 0.55 } as const;

  // Part 0 — collar + pull tab (sits on the heel).
  const collar = new Container();
  {
    const g = new Graphics();
    g.roundRect(-0.44 * u, -0.365 * u, 0.09 * u, 0.08 * u, 0.028 * u).fill(accent); // pull tab
    g.roundRect(-0.47 * u, -0.315 * u, 0.45 * u, 0.11 * u, 0.05 * u).fill(bodyColor);
    g.roundRect(-0.47 * u, -0.315 * u, 0.45 * u, 0.11 * u, 0.05 * u).fill({ color: 0xffffff, alpha: 0.16 });
    collar.addChild(g);
  }

  // Part 1 — the upper (heel curve sloping down to the toe).
  const upper = new Container();
  {
    const g = new Graphics();
    g.moveTo(0.5 * u, 0.018 * u)
      .lineTo(-0.5 * u, 0.018 * u)
      .quadraticCurveTo(-0.545 * u, -0.1 * u, -0.46 * u, -0.185 * u)
      .quadraticCurveTo(-0.3 * u, -0.255 * u, -0.1 * u, -0.215 * u)
      .bezierCurveTo(0.12 * u, -0.16 * u, 0.32 * u, -0.07 * u, 0.5 * u, 0.018 * u)
      .closePath()
      .fill(bodyColor);
    upper.addChild(g);
    if (showDetails) {
      const d = new Graphics();
      // Side stroke sweeping toward the heel.
      d.moveTo(-0.36 * u, -0.03 * u)
        .quadraticCurveTo(0.0 * u, -0.115 * u, 0.3 * u, -0.035 * u)
        .stroke({ color: accent, width: Math.max(2, 0.02 * u), cap: "round", alpha: 0.9 });
      // Eyelets along the instep.
      for (const [ex, ey] of [
        [0.02, -0.15],
        [0.12, -0.112],
        [0.22, -0.074],
      ] as const) {
        d.circle(ex * u, ey * u, 0.015 * u).fill(detailInk);
      }
      upper.addChild(d);
      // Lace bars crossing the instep.
      for (const [lx, ly] of [
        [-0.015, -0.183],
        [0.095, -0.145],
        [0.205, -0.107],
      ] as const) {
        const lace = new Graphics().roundRect(-0.025 * u, -0.07 * u, 0.05 * u, 0.14 * u, 0.025 * u).fill(accent);
        lace.position.set(lx * u, ly * u);
        lace.rotation = 1.05;
        upper.addChild(lace);
      }
    }
  }

  // Part 2 — midsole.
  const midsole = new Container();
  {
    const g = new Graphics();
    g.roundRect(-0.49 * u, 0.012 * u, 0.98 * u, 0.082 * u, 0.041 * u).fill(midColor);
    g.roundRect(-0.49 * u, 0.012 * u, 0.98 * u, 0.082 * u, 0.041 * u).stroke({ color: muted, width: Math.max(1.5, 0.008 * u), alpha: 0.5 });
    midsole.addChild(g);
    if (showDetails) {
      const pods = new Graphics();
      pods.roundRect(-0.26 * u, 0.036 * u, 0.16 * u, 0.034 * u, 0.017 * u).fill({ color: accent, alpha: 0.35 });
      pods.roundRect(0.08 * u, 0.036 * u, 0.16 * u, 0.034 * u, 0.017 * u).fill({ color: accent, alpha: 0.35 });
      midsole.addChild(pods);
    }
  }

  // Part 3 — outsole.
  const outsole = new Container();
  {
    const g = new Graphics();
    g.roundRect(-0.505 * u, 0.088 * u, 1.01 * u, 0.095 * u, 0.045 * u).fill(soleColor);
    outsole.addChild(g);
    if (showDetails) {
      const grips = new Graphics();
      for (let i = 0; i < 5; i++) {
        grips.circle((-0.4 + i * 0.2) * u, 0.152 * u, 0.016 * u).fill(detailInk);
      }
      outsole.addChild(grips);
    }
  }

  const parts: PartSpec[] = [
    { node: collar, exp: -0.24, lineY: -0.5, lineX: 0.0, side: 1 },
    { node: upper, exp: -0.1, lineY: -0.215, lineX: -0.53, side: -1 },
    { node: midsole, exp: 0.05, lineY: 0.103, lineX: 0.51, side: 1 },
    { node: outsole, exp: 0.2, lineY: 0.3355, lineX: -0.53, side: -1 },
  ];
  // Bottom-up draw order so upper overlaps sit naturally.
  P.addChild(outsole, midsole, upper, collar);

  // Explode apart, hold, reassemble.
  parts.forEach((p, i) => {
    const expPx = p.exp * u;
    timeline
      .to(p.node, { prop: "y", from: 0, to: expPx, start: EXPLODE + i * EX_STAGGER, duration: EX_DUR, ease: outQuint })
      .to(p.node, { prop: "y", from: expPx, to: 0, start: RETURN + i * RE_STAGGER, duration: RE_DUR, ease: outQuint });
  });

  // --- Annotations: leader lines + labels at the exploded pose ---
  const annotC = new Container();
  P.addChild(annotC);
  timeline.to(annotC, { prop: "alpha", from: 1, to: 0, start: ANNOT_OUT, duration: 0.22, ease: outQuad });

  const lineW = Math.max(2, minDim * 0.0035);
  const labelMaxW = zone.width / 2 - 0.65 * u - minDim * 0.012;

  parts.forEach((p, i) => {
    const label = labels[i];
    if (!label) return;
    const at = ANNOT_IN + i * ANNOT_STAGGER;
    const yPx = p.lineY * u;
    const startX = p.lineX * u;
    const endX = p.side * 0.62 * u;

    // The line grows outward from the part edge; direction handled by a flip.
    const lineC = new Container();
    lineC.position.set(startX, yPx);
    lineC.scale.x = endX >= startX ? 1 : -1;
    const inner = new Container();
    inner.addChild(new Graphics().rect(0, -lineW / 2, Math.abs(endX - startX), lineW).fill(muted));
    inner.scale.x = 0;
    lineC.addChild(inner);
    annotC.addChild(lineC);
    timeline.to(inner, { prop: "scale.x", from: 0, to: 1, start: at, duration: 0.35, ease: outExpo });

    if (showDots) {
      const dot = new Graphics().circle(0, 0, minDim * 0.008).fill(accent);
      dot.position.set(startX, yPx);
      dot.scale.set(0);
      annotC.addChild(dot);
      timeline
        .to(dot, { prop: "scale.x", from: 0, to: 1, start: at, duration: 0.3, ease: makeOutBack(2) })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start: at, duration: 0.3, ease: makeOutBack(2) });
    }

    const lSize = fitSize(fonts, label, "body", 700, Math.round(minDim * 0.031), labelMaxW);
    const lText = makeText(fonts, { text: label, role: "body", weight: 700, size: lSize, color: textColor, anchor: { x: p.side > 0 ? 0 : 1, y: 0.5 } });
    const lx = p.side * 0.65 * u;
    lText.position.set(lx, yPx);
    lText.alpha = 0;
    annotC.addChild(lText);
    timeline
      .to(lText, { prop: "alpha", from: 0, to: 1, start: at + 0.1, duration: 0.35, ease: outQuad })
      .to(lText, { prop: "x", from: lx + p.side * 14, to: lx, start: at + 0.1, duration: 0.45, ease: outQuint });
  });

  // --- Product name (appears once reassembled) ---
  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * 0.05), zone.width * 0.8);
  const nameY = pcy + 0.183 * u + minDim * 0.085;
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: NAME_IN, duration: 0.35, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 16, to: nameY, start: NAME_IN, duration: 0.45, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const explodedView: TemplateDefinition = {
  id: "exploded-view",
  name: "Exploded View",
  tagline: "A layered product pulls apart into a labeled diagram, then snaps back.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.1,
  fontRoles: { name: "display" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "What's inside", maxLength: 24, optional: true },
    { key: "name", type: "text", label: "Product name", default: "Volt Runner", maxLength: 24, shrinkToFit: true },
    {
      key: "labels",
      type: "textlist",
      label: "Part labels",
      default: DEFAULT_LABELS,
      minItems: 4,
      maxItems: 4,
      maxLength: 18,
      help: "Top to bottom: collar, upper, midsole, outsole.",
    },
    { key: "showDetails", type: "toggle", label: "Detail accents", default: true },
    { key: "showDots", type: "toggle", label: "Leader dots", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "bodyColor", type: "color", label: "Upper", default: "", optional: true },
    { key: "soleColor", type: "color", label: "Sole", default: "", optional: true },
  ],
  build,
};
