import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { arcPoints, dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const DEG = Math.PI / 180;

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "parchment-crimson", name: "Parchment crimson", colors: { background: "#EDE3CC", cardColor: "#F7F0DC", textColor: "#4A3B22", accent: "#A3222E" } },
  { id: "parchment-indigo", name: "Parchment indigo", colors: { background: "#E7E4D8", cardColor: "#F5F2E4", textColor: "#3A3A2E", accent: "#29407A" } },
  { id: "parchment-forest", name: "Parchment forest", colors: { background: "#E7E9D8", cardColor: "#F4F3E2", textColor: "#333B24", accent: "#1F5C3D" } },
  { id: "midnight-violet", name: "Midnight violet", colors: { background: "#16151C", cardColor: "#221F2B", textColor: "#C9C4D6", accent: "#A98CFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EDE3CC"));
  const cardColor = pc("cardColor", "#F7F0DC");
  const textColor = str(values.textColor, pc("textColor", "#4A3B22"));
  const accent = str(values.accent, pc("accent", "#A3222E"));
  const showInkSpread = values.showInkSpread !== false;

  const destination = str(values.destination, "Japan").toUpperCase();
  const dateVal = str(values.date, "12 SEP 2026");

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // minDim is 1080 for every aspect, so the page can use fixed fractions of it;
  // only its position needs to adapt per aspect (via safeRect).
  const pageW = minDim * 0.62;
  const pageH = minDim * 0.78;
  const rect = safeRect(ctx.aspect);
  const pageCx = w / 2;
  const pageCy = rect.y + rect.height / 2;

  const page = new Container();
  page.position.set(pageCx, pageCy);
  page.alpha = 0;
  root.addChild(page);
  timeline.to(page, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.3, ease: outQuad });

  // Parchment panel.
  const panelRadius = minDim * 0.016;
  page.addChild(new Graphics().roundRect(-pageW / 2, -pageH / 2, pageW, pageH, panelRadius).fill(cardColor));
  page.addChild(
    new Graphics()
      .roundRect(-pageW / 2, -pageH / 2, pageW, pageH, panelRadius)
      .stroke({ color: textColor, width: Math.max(1, minDim * 0.0015), alpha: 0.18 }),
  );

  // Faint guilloché lines — fixed sine curves, fully deterministic.
  const guil = new Graphics();
  const linesN = 6;
  for (let li = 0; li < linesN; li++) {
    const freq = 2 + li * 0.6;
    const amp = pageH * 0.024;
    const yOff = -pageH * 0.32 + li * ((pageH * 0.64) / (linesN - 1));
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = -pageW * 0.4 + u * pageW * 0.8;
      const y = yOff + Math.sin(u * Math.PI * freq + li * 0.9) * amp;
      if (i === 0) guil.moveTo(x, y);
      else guil.lineTo(x, y);
    }
  }
  guil.stroke({ color: textColor, width: Math.max(1, minDim * 0.0012), alpha: 0.09 });
  page.addChild(guil);

  // Small static page caption.
  const capSize = Math.round(minDim * 0.026);
  const caption = makeText(fonts, { text: "PASSPORT", role: "body", weight: 600, size: capSize, color: textColor, anchor: 0.5, letterSpacing: 5 });
  caption.position.set(0, -pageH / 2 + pageH * 0.08);
  caption.alpha = 0.9;
  page.addChild(caption);

  // --- Ink-spread bloom (optional), behind the stamp ---
  const R = minDim * 0.19;
  if (showInkSpread) {
    const halo1 = new Graphics().circle(0, 0, R * 0.95).fill({ color: accent, alpha: 0.22 });
    const halo2 = new Graphics().circle(0, 0, R * 0.72).fill({ color: accent, alpha: 0.2 });
    halo1.scale.set(0.6);
    halo2.scale.set(0.5);
    halo1.alpha = 0;
    halo2.alpha = 0;
    page.addChild(halo1, halo2);
    const slamT = 0.5;
    timeline
      .to(halo1, { prop: "scale.x", from: 0.6, to: 1.7, start: slamT, duration: 0.5, ease: outExpo })
      .to(halo1, { prop: "scale.y", from: 0.6, to: 1.7, start: slamT, duration: 0.5, ease: outExpo })
      .to(halo1, { prop: "alpha", from: 0, to: 1, start: slamT, duration: 0.08, ease: outQuad })
      .to(halo1, { prop: "alpha", from: 1, to: 0, start: slamT + 0.08, duration: 0.45, ease: outQuad })
      .to(halo2, { prop: "scale.x", from: 0.5, to: 1.4, start: slamT, duration: 0.45, ease: outExpo })
      .to(halo2, { prop: "scale.y", from: 0.5, to: 1.4, start: slamT, duration: 0.45, ease: outExpo })
      .to(halo2, { prop: "alpha", from: 0, to: 0.9, start: slamT, duration: 0.08, ease: outQuad })
      .to(halo2, { prop: "alpha", from: 0.9, to: 0, start: slamT + 0.08, duration: 0.4, ease: outQuad });
  }

  // --- The stamp (concentric rings + angled text) ---
  const restAngle = -9 * DEG;
  const stamp = new Container();
  stamp.position.set(0, 0);
  stamp.scale.set(1.6);
  stamp.rotation = restAngle - 25 * DEG;
  stamp.alpha = 0.25;
  page.addChild(stamp);

  stamp.addChild(new Graphics().circle(0, 0, R).stroke({ color: accent, width: Math.max(2, R * 0.045) }));
  const midRing = new Graphics();
  dashedPath(midRing, arcPoints(0, 0, R * 0.84, 0, Math.PI * 2, 80), { dash: 7, gap: 6, width: Math.max(2, R * 0.03), color: accent, cap: "round" });
  stamp.addChild(midRing);
  stamp.addChild(new Graphics().circle(0, 0, R * 0.64).stroke({ color: accent, width: Math.max(2, R * 0.02) }));

  const destSize = fitSize(fonts, destination, "display", 700, Math.round(R * 0.32), R * 1.3);
  const destText = makeText(fonts, { text: destination, role: "display", weight: 700, size: destSize, color: accent, anchor: 0.5, align: "center" });
  destText.position.set(0, -R * 0.24);
  stamp.addChild(destText);

  const dividerW = R * 0.46;
  const divider = new Graphics().roundRect(-dividerW / 2, 0, dividerW, Math.max(2, R * 0.025), 1).fill({ color: accent, alpha: 0.85 });
  divider.position.set(0, R * 0.02);
  stamp.addChild(divider);

  const dateSize = fitSize(fonts, dateVal, "body", 600, Math.round(R * 0.15), R * 1.25, 1.5);
  const dateText = makeText(fonts, { text: dateVal, role: "body", weight: 600, size: dateSize, color: accent, anchor: 0.5, letterSpacing: 1.5 });
  dateText.position.set(0, R * 0.26);
  stamp.addChild(dateText);

  const slamT = 0.5;
  const slamDur = 0.32;
  timeline
    .to(stamp, { prop: "scale.x", from: 1.6, to: 1, start: slamT, duration: slamDur, ease: outBack })
    .to(stamp, { prop: "scale.y", from: 1.6, to: 1, start: slamT, duration: slamDur, ease: outBack })
    .to(stamp, { prop: "alpha", from: 0.25, to: 1, start: slamT, duration: 0.15, ease: outQuad })
    .to(stamp, { prop: "rotation", from: restAngle - 25 * DEG, to: restAngle, start: slamT, duration: slamDur, ease: outExpo })
    // Quick post-impact shake, decaying back to the resting angle.
    .to(stamp, { prop: "rotation", from: restAngle, to: restAngle - 3 * DEG, start: slamT + slamDur, duration: 0.08, ease: outQuad })
    .to(stamp, { prop: "rotation", from: restAngle - 3 * DEG, to: restAngle + 2 * DEG, start: slamT + slamDur + 0.08, duration: 0.08, ease: outQuad })
    .to(stamp, { prop: "rotation", from: restAngle + 2 * DEG, to: restAngle - 1 * DEG, start: slamT + slamDur + 0.16, duration: 0.08, ease: outQuad })
    .to(stamp, { prop: "rotation", from: restAngle - 1 * DEG, to: restAngle, start: slamT + slamDur + 0.24, duration: 0.12, ease: outQuad });

  return { timeline, duration: 2.6 };
}

export const passportStamp: TemplateDefinition = {
  id: "passport-stamp",
  name: "Passport Stamp",
  tagline: "An ink stamp slams onto a passport page to mark the destination.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 1.8,
  palettes: PALETTES,
  fields: [
    { key: "destination", type: "text", label: "Destination", default: "Japan", maxLength: 20, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "12 SEP 2026", maxLength: 20 },
    { key: "showInkSpread", type: "toggle", label: "Ink-spread bloom", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
