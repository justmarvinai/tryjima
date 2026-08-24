import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { pointerCursor } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

/** A simple crown silhouette, centered at (0,0). */
function crown(s: number, color: string): Graphics {
  return new Graphics()
    .poly([
      -0.5 * s, 0.34 * s, -0.5 * s, -0.16 * s, -0.24 * s, 0.08 * s, 0, -0.36 * s,
      0.24 * s, 0.08 * s, 0.5 * s, -0.16 * s, 0.5 * s, 0.34 * s,
    ])
    .fill(color);
}

const GRADS: [string, string][] = [
  ["#4457E8", "#22D3EE"],
  ["#FF5B72", "#FF9A3D"],
];

// A "This or That" tap poll: two option blocks pop in, a finger taps the winner,
// its % bar fills and a crown appears. Full-frame `bg` carries the background;
// blocks are decorative gradient photos with a dark caption scrim for legibility.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#12141A", accent: "#FF3B30", chipBg: "#FFFFFF", scrim: "#0B0B10" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", textColor: "#FFFFFF", accent: "#FFB020", chipBg: "#1C1C22", scrim: "#050507" } },
  { id: "grape", name: "Grape", colors: { background: "#17102E", textColor: "#FFFFFF", accent: "#FFC24D", chipBg: "#241645", scrim: "#0C0720" } },
  { id: "mint", name: "Mint", colors: { background: "#EAF7EE", textColor: "#08221A", accent: "#17A34A", chipBg: "#FFFFFF", scrim: "#06231A" } },
];

interface BlockRefs {
  c: Container;
  fill: Graphics;
  pct: Text;
}

const Q_START = 0.1;
const A_START = 0.4;
const B_START = 0.55;
const TAP_AT = 1.45;
const FILL_START = 1.55;
const FILL_DUR = 0.8;
const WIN_AT = FILL_START + FILL_DUR;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#12141A"));
  const accent = str(values.accent, pc("accent", "#FF3B30"));
  const chipBg = pc("chipBg", "#FFFFFF");
  const scrim = pc("scrim", "#0B0B10");
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";

  const question = str(values.question, "This or That?");
  const optionA = str(values.optionA, "Beach");
  const optionB = str(values.optionB, "Mountains");
  const resultA = Math.round(clamp(num(values.result, 62), 0, 100));
  const resultB = 100 - resultA;
  const winnerIsA = resultA >= 50;
  const fracA = resultA / 100;
  const fracB = resultB / 100;
  const showCrown = on(values.showCrown);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const familyD = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family: familyD, weight: 700, size: sz });

  // --- Question pill ---
  const clusterW = Math.min(safe.width * 0.96, minDim * 1.15);
  const qBase = Math.round(minDim * 0.05);
  const qPadX = Math.round(minDim * 0.05);
  const qPadY = Math.round(minDim * 0.03);
  const qSize = fitSize(fonts, question, "display", 700, qBase, clusterW - qPadX * 2);
  const qWidth = Math.min(measure(question, qSize) + qPadX * 2, clusterW);
  const qHeight = qSize + qPadY * 2;

  // --- Block geometry ---
  const blockGap = Math.round(minDim * 0.03);
  const blockW = (clusterW - blockGap) / 2;
  const blockR = Math.round(blockW * 0.08);
  const gapQ = Math.round(minDim * 0.04);
  const availH = safe.height - qHeight - gapQ;
  const blockH = Math.min(availH * 0.96, blockW * 1.4);
  const totalH = qHeight + gapQ + blockH;
  const top = safe.y + Math.max(0, (safe.height - totalH) / 2);
  const qCy = top + qHeight / 2;
  const blockCy = top + qHeight + gapQ + blockH / 2;
  const leftCx = cx - blockGap / 2 - blockW / 2;
  const rightCx = cx + blockGap / 2 + blockW / 2;

  function makeBlock(label: string, grad: [string, string], winnerFill: boolean): BlockRefs {
    const c = new Container();
    const bw = blockW;
    const bh = blockH;
    // Gradient photo stand-in.
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, blockR).fill(grad[0]));
    const gh = new Container();
    const tri = new Graphics().poly([-bw / 2, bh * 0.2, bw / 2, -bh / 2, bw / 2, bh / 2, -bw / 2, bh / 2]).fill(grad[1]);
    const gm = new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, blockR).fill(0xffffff);
    gh.addChild(tri, gm);
    tri.mask = gm;
    c.addChild(gh);

    // Caption scrim (bottom band), masked to the tile.
    const scrimH = bh * 0.4;
    const scrimTop = bh / 2 - scrimH;
    const sc = new Container();
    const srect = new Graphics().rect(-bw / 2, scrimTop, bw, scrimH).fill(scrim);
    const sm = new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, blockR).fill(0xffffff);
    sc.addChild(srect, sm);
    srect.mask = sm;
    c.addChild(sc);

    const sPad = bw * 0.09;
    const rowY = scrimTop + scrimH * 0.34;
    const pctSize = Math.round(scrimH * 0.26);
    const pctReserve = measure("100%", pctSize) + pctSize * 0.4;
    const labelSize = fitSize(fonts, label, "display", 700, Math.round(scrimH * 0.26), bw - sPad * 2 - pctReserve);
    const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelSize, color: "#FFFFFF", anchor: { x: 0, y: 0.5 } });
    labelText.position.set(-bw / 2 + sPad, rowY);
    c.addChild(labelText);
    const pctText = makeText(fonts, { text: "0%", role: "display", weight: 700, size: pctSize, color: "#FFFFFF", anchor: { x: 1, y: 0.5 } });
    pctText.position.set(bw / 2 - sPad, rowY);
    c.addChild(pctText);

    const barY = scrimTop + scrimH * 0.74;
    const barW = bw - sPad * 2;
    const barH = Math.max(6, scrimH * 0.12);
    c.addChild(new Graphics().roundRect(-barW / 2, barY - barH / 2, barW, barH, barH / 2).fill({ color: "#FFFFFF", alpha: 0.24 }));
    const fill = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(winnerFill ? accent : "#FFFFFF");
    fill.position.set(-barW / 2, barY - barH / 2);
    fill.scale.set(0, 1);
    c.addChild(fill);

    return { c, fill, pct: pctText };
  }

  const blockA = makeBlock(optionA, GRADS[0]!, winnerIsA);
  const blockB = makeBlock(optionB, GRADS[1]!, !winnerIsA);

  // --- Question pill entrance ---
  const qPill = new Container();
  qPill.addChild(new Graphics().roundRect(-qWidth / 2, -qHeight / 2, qWidth, qHeight, qHeight / 2).fill(chipBg));
  qPill.addChild(makeText(fonts, { text: question, role: "display", weight: 700, size: qSize, color: textColor, anchor: 0.5, align: "center" }));
  qPill.position.set(cx, qCy + minDim * 0.03);
  qPill.alpha = 0;
  qPill.scale.set(0.7);
  root.addChild(qPill);
  timeline
    .to(qPill, { prop: "alpha", from: 0, to: 1, start: Q_START, duration: 0.3, ease: outQuad })
    .to(qPill, { prop: "scale.x", from: 0.7, to: 1, start: Q_START, duration: 0.55, ease: spring(0.45) })
    .to(qPill, { prop: "scale.y", from: 0.7, to: 1, start: Q_START, duration: 0.55, ease: spring(0.45) })
    .to(qPill, { prop: "y", from: qCy + minDim * 0.03, to: qCy, start: Q_START, duration: 0.55, ease: outExpo });

  // --- Block entrances ---
  const placeBlock = (b: BlockRefs, bx: number, start: number): void => {
    b.c.position.set(bx, blockCy + minDim * 0.03);
    b.c.alpha = 0;
    b.c.scale.set(0.86);
    root.addChild(b.c);
    timeline
      .to(b.c, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(b.c, { prop: "scale.x", from: 0.86, to: 1, start, duration: 0.55, ease: spring(0.44) })
      .to(b.c, { prop: "scale.y", from: 0.86, to: 1, start, duration: 0.55, ease: spring(0.44) })
      .to(b.c, { prop: "y", from: blockCy + minDim * 0.03, to: blockCy, start, duration: 0.55, ease: outExpo });
  };
  placeBlock(blockA, leftCx, A_START);
  placeBlock(blockB, rightCx, B_START);

  // --- OR divider ---
  const orR = Math.round(blockGap * 0.9 + minDim * 0.028);
  const orC = new Container();
  orC.position.set(cx, blockCy);
  orC.scale.set(0);
  root.addChild(orC);
  orC.addChild(new Graphics().circle(0, 0, orR).fill(accent));
  orC.addChild(makeText(fonts, { text: "OR", role: "display", weight: 700, size: Math.round(orR * 0.72), color: onAccent, anchor: 0.5 }));
  timeline
    .to(orC, { prop: "scale.x", from: 0, to: 1, start: 0.72, duration: 0.5, ease: makeOutBack(2) })
    .to(orC, { prop: "scale.y", from: 0, to: 1, start: 0.72, duration: 0.5, ease: makeOutBack(2) });

  // --- Winner emphasis: fill bars, ring, crown ---
  const winner = winnerIsA ? blockA : blockB;
  const winnerCx = winnerIsA ? leftCx : rightCx;
  timeline
    .to(blockA.fill, { prop: "scale.x", from: 0, to: fracA, start: FILL_START, duration: FILL_DUR, ease: outExpo })
    .to(blockB.fill, { prop: "scale.x", from: 0, to: fracB, start: FILL_START, duration: FILL_DUR, ease: outExpo });

  const ring = new Graphics()
    .roundRect(-blockW / 2 - minDim * 0.012, -blockH / 2 - minDim * 0.012, blockW + minDim * 0.024, blockH + minDim * 0.024, blockR + minDim * 0.012)
    .stroke({ color: accent, width: Math.max(3, minDim * 0.008) });
  ring.alpha = 0;
  winner.c.addChild(ring);
  timeline.to(ring, { prop: "alpha", from: 0, to: 1, start: WIN_AT, duration: 0.3, ease: outQuad });
  timeline
    .to(winner.c, { prop: "scale.x", from: 1, to: 1.04, start: WIN_AT, duration: 0.16, ease: outQuad })
    .to(winner.c, { prop: "scale.y", from: 1, to: 1.04, start: WIN_AT, duration: 0.16, ease: outQuad })
    .to(winner.c, { prop: "scale.x", from: 1.04, to: 1, start: WIN_AT + 0.16, duration: 0.3, ease: outQuad })
    .to(winner.c, { prop: "scale.y", from: 1.04, to: 1, start: WIN_AT + 0.16, duration: 0.3, ease: outQuad });

  if (showCrown) {
    const crownS = blockW * 0.32;
    const cr = crown(crownS, accent);
    cr.position.set(0, -blockH / 2 - crownS * 0.28);
    cr.scale.set(0);
    cr.rotation = -0.12;
    winner.c.addChild(cr);
    timeline
      .to(cr, { prop: "scale.x", from: 0, to: 1, start: WIN_AT + 0.05, duration: 0.5, ease: makeOutBack(2.4) })
      .to(cr, { prop: "scale.y", from: 0, to: 1, start: WIN_AT + 0.05, duration: 0.5, ease: makeOutBack(2.4) })
      .to(cr, { prop: "rotation", from: -0.12, to: 0, start: WIN_AT + 0.05, duration: 0.6, ease: outExpo });
  }

  // --- Finger taps the winner ---
  const cur = pointerCursor(minDim * 0.1, "#FFFFFF", "#101014");
  const curFrom = { x: winnerCx + blockW * 0.32, y: blockCy + blockH * 0.72 };
  const curTo = { x: winnerCx + blockW * 0.12, y: blockCy + blockH * 0.12 };
  cur.position.set(curFrom.x, curFrom.y);
  cur.alpha = 0;
  root.addChild(cur);
  timeline
    .to(cur, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.3, ease: outQuad })
    .to(cur, { prop: "x", from: curFrom.x, to: curTo.x, start: 0.9, duration: 0.55, ease: outExpo })
    .to(cur, { prop: "y", from: curFrom.y, to: curTo.y, start: 0.9, duration: 0.55, ease: outExpo })
    .to(cur, { prop: "scale.x", from: 1, to: 0.84, start: TAP_AT, duration: 0.09, ease: outQuad })
    .to(cur, { prop: "scale.y", from: 1, to: 0.84, start: TAP_AT, duration: 0.09, ease: outQuad })
    .to(cur, { prop: "scale.x", from: 0.84, to: 1, start: TAP_AT + 0.09, duration: 0.18, ease: makeOutBack(2) })
    .to(cur, { prop: "scale.y", from: 0.84, to: 1, start: TAP_AT + 0.09, duration: 0.18, ease: makeOutBack(2) })
    .to(cur, { prop: "alpha", from: 1, to: 0, start: WIN_AT + 0.2, duration: 0.4, ease: outQuad });

  // --- Live % count-up synced to the fill ---
  const update = (t: number): void => {
    const u = t <= FILL_START ? 0 : t >= WIN_AT ? 1 : (t - FILL_START) / FILL_DUR;
    const eased = 1 - Math.pow(1 - u, 3);
    blockA.pct.text = `${Math.round(resultA * eased)}%`;
    blockB.pct.text = `${Math.round(resultB * eased)}%`;
  };

  return { timeline, duration: DURATION, update };
}

export const thisOrThat: TemplateDefinition = {
  id: "this-or-that",
  name: "This or That",
  tagline: "Two options pop up, a finger taps one, its bar fills and it gets crowned.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { question: "display", optionA: "display", optionB: "display" },
  palettes: PALETTES,
  fields: [
    { key: "question", type: "text", label: "Question", default: "This or That?", maxLength: 32, shrinkToFit: true },
    { key: "optionA", type: "text", label: "Option A", default: "Beach", maxLength: 18, shrinkToFit: true },
    { key: "optionB", type: "text", label: "Option B", default: "Mountains", maxLength: 18, shrinkToFit: true },
    { key: "result", type: "slider", label: "Result (% to A)", default: 62, min: 0, max: 100, step: 1 },
    { key: "showCrown", type: "toggle", label: "Crown the winner", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
