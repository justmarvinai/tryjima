import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Shrink a single-line size so `text` fits `maxWidth`. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A corner "bug" (LIVE-tag style). Only the full-frame `bg` rect is tied to
// the background field (blanked by transparent export); the tag surface uses
// its own palette-only `bugBg` so it survives as overlay content.
const PALETTES: Palette[] = [
  { id: "classic-live", name: "Classic live", colors: { background: "#FFFFFF", bugBg: "#101014", textColor: "#FFFFFF", accent: "#FF3B30" } },
  { id: "midnight-ember", name: "Midnight ember", colors: { background: "#101014", bugBg: "#1C1C22", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "paper-cobalt", name: "Paper cobalt", colors: { background: "#F1F4F9", bugBg: "#FFFFFF", textColor: "#16233A", accent: "#3B5BA5" } },
  { id: "berry-night", name: "Berry night", colors: { background: "#1B0E18", bugBg: "#2A1526", textColor: "#FFFFFF", accent: "#FF2E9E" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const bugBg = pc("bugBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF3B30"));
  const label = str(values.label, "LIVE");
  const showPulse = values.showPulse !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const dotR = Math.round(minDim * 0.014);
  const padX = Math.round(minDim * 0.022);
  const padY = Math.round(minDim * 0.014);
  const dotGap = Math.round(minDim * 0.014);

  const maxLabelW = w * 0.4;
  const labelSize = fitSize(fonts, label, "display", 700, Math.round(minDim * 0.024), maxLabelW);
  const labelW = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: labelSize });

  const dotBlockW = showPulse ? dotR * 2 + dotGap : 0;
  const contentH = Math.max(showPulse ? dotR * 2 : 0, Math.round(labelSize * 0.9));
  const bugH = padY * 2 + contentH;
  const bugW = padX * 2 + dotBlockW + labelW;
  const bugRadius = Math.round(bugH * 0.3);

  const restX = zone.left + bugW / 2;
  const restY = zone.top + bugH / 2;
  const startX = -bugW;

  const bug = new Container();
  bug.position.set(startX, restY);
  bug.alpha = 0;
  root.addChild(bug);

  const e = Math.round(bugH * 0.05);
  const off = Math.round(bugH * 0.08);
  bug.addChild(
    new Graphics()
      .roundRect(-bugW / 2 - e, -bugH / 2 - e + off, bugW + e * 2, bugH + e * 2, bugRadius + e)
      .fill({ color: "#000000", alpha: 0.2 }),
  );
  bug.addChild(new Graphics().roundRect(-bugW / 2, -bugH / 2, bugW, bugH, bugRadius).fill(bugBg));

  let cursorX = -bugW / 2 + padX;
  let dot: Graphics | undefined;
  let ring: Graphics | undefined;
  if (showPulse) {
    const dotX = cursorX + dotR;
    ring = new Graphics().circle(0, 0, dotR).stroke({ color: accent, width: Math.max(1.5, dotR * 0.22) });
    ring.position.set(dotX, 0);
    ring.alpha = 0;
    bug.addChild(ring);
    dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dot.position.set(dotX, 0);
    bug.addChild(dot);
    cursorX += dotR * 2 + dotGap;
  }

  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 700,
    size: labelSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: labelSize * 0.02,
  });
  labelText.position.set(cursorX, 0);
  bug.addChild(labelText);

  // Entrance: slides in from off-canvas, out of the corner.
  const enterStart = 0.1;
  const enterDur = 0.5;
  timeline
    .to(bug, { prop: "x", from: startX, to: restX, start: enterStart, duration: enterDur, ease: outExpo })
    .to(bug, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad });

  // A soft, continuous breathing pulse (dot scale + expanding ring), looping
  // through the hold once the tag has landed.
  const pulseStart = enterStart + enterDur;
  const PULSE_PERIOD = 1.1;
  const update = (t: number): void => {
    if (!dot || !ring) return;
    if (t < pulseStart) {
      dot.scale.set(1);
      ring.alpha = 0;
      return;
    }
    const u = ((t - pulseStart) % PULSE_PERIOD) / PULSE_PERIOD;
    dot.scale.set(1 + 0.16 * Math.sin(u * Math.PI));
    ring.scale.set(0.6 + 1.6 * u);
    // sin(u·π) fades 0→peak→0 across the cycle, so alpha matches at u=0 and
    // u=1 — the ring's scale jump at the wrap point lands while invisible.
    ring.alpha = 0.55 * Math.sin(u * Math.PI);
  };

  return { timeline, duration: 4.0, update };
}

export const topicBug: TemplateDefinition = {
  id: "topic-bug",
  name: "Topic Bug",
  tagline: "A corner tag slides in with a softly pulsing live dot.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "LIVE", maxLength: 24, shrinkToFit: true },
    { key: "showPulse", type: "toggle", label: "Pulsing dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
