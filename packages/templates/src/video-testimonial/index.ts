import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { avatar } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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

function wrapText(
  fonts: FontRegistry,
  o: { text: string; role: FontRole; weight: number; size: number; color: string; width: number; lineHeight: number; align: "left" | "center"; anchor: { x: number; y: number } },
): Text {
  const t = makeText(fonts, { text: o.text, role: o.role, weight: o.weight, size: o.size, color: o.color, align: o.align, anchor: o.anchor, lineHeight: o.lineHeight });
  t.style.wordWrap = true;
  t.style.wordWrapWidth = o.width;
  return t;
}

// A testimonial framed as a video call: a person tile (avatar + name lower-third
// + REC) beside a pull-quote. The tile uses its own dark `tileBg` with white
// `onTile` text; the quote sits on `bg` in `textColor` at ≥4.5:1. REC dot is red
// (semantic, decorative) and pulses via a pure update(t).
const REC_COLOR = "#FF3B30";

const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F7", textColor: "#0F1420", accent: "#3B4FD6", onAccent: "#FFFFFF", tileBg: "#1B2233", onTile: "#FFFFFF" } },
  { id: "cream", name: "Cream", colors: { background: "#F6EEE2", textColor: "#241A12", accent: "#C2410C", onAccent: "#FFFFFF", tileBg: "#2A2018", onTile: "#FFFFFF" } },
  { id: "blush", name: "Blush", colors: { background: "#FDEEF4", textColor: "#2A0E1C", accent: "#BE185D", onAccent: "#FFFFFF", tileBg: "#2A1420", onTile: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#6EA8FE", onAccent: "#0C1018", tileBg: "#1E2635", onTile: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F7"));
  const textColor = str(values.textColor, pc("textColor", "#0F1420"));
  const accent = str(values.accent, pc("accent", "#3B4FD6"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const tileBg = pc("tileBg", "#1B2233");
  const onTile = pc("onTile", "#FFFFFF");

  const name = str(values.name, "Jordan Lee");
  const role = str(values.role, "Head of Social");
  const quote = str(values.quote, "We ship a week of content in an afternoon now.");
  const showREC = values.showREC !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height * 0.5;
  const minDim = Math.min(w, h);
  const isWide = ctx.aspect === "16:9";

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Resolve tile + quote regions per aspect ---
  let tileW: number;
  let tileH: number;
  let tileCx: number;
  let tileCy: number;
  let quoteCx: number;
  let quoteCy: number;
  let quoteW: number;
  let quoteAnchorY: number; // 0.5 center (wide) or 0 top (stacked)
  if (isWide) {
    tileW = zone.width * 0.4;
    tileH = tileW * 0.74;
    tileCx = zone.x + tileW / 2;
    tileCy = cy;
    const quoteLeft = zone.x + tileW + zone.width * 0.06;
    quoteW = zone.x + zone.width - quoteLeft;
    quoteCx = quoteLeft;
    quoteCy = cy;
    quoteAnchorY = 0.5;
  } else {
    tileW = Math.min(zone.width * 0.82, minDim * 0.8);
    tileH = tileW * 0.64;
    tileCx = cx;
    tileCy = zone.y + zone.height * 0.31;
    quoteW = zone.width * 0.86;
    quoteCx = cx;
    quoteCy = tileCy + tileH / 2 + minDim * 0.08;
    quoteAnchorY = 0;
  }
  const tileR = Math.round(minDim * 0.028);
  const inset = tileW * 0.06;

  // --- Video tile ---
  const tile = new Container();
  tile.position.set(tileCx, tileCy);
  tile.alpha = 0;
  tile.scale.set(0.92);
  root.addChild(tile);

  const e = Math.round(minDim * 0.006);
  const off = Math.round(minDim * 0.012);
  tile.addChild(new Graphics().roundRect(-tileW / 2 - e, -tileH / 2 - e + off, tileW + e * 2, tileH + e * 2, tileR + e).fill({ color: "#000000", alpha: 0.16 }));
  tile.addChild(new Graphics().roundRect(-tileW / 2, -tileH / 2, tileW, tileH, tileR).fill(tileBg));

  // Avatar (person).
  const rAv = tileH * 0.22;
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const av = avatar(fonts, { radius: rAv, bg: accent, initial, textColor: onAccent });
  av.position.set(0, -tileH * 0.1);
  av.scale.set(0);
  tile.addChild(av);
  timeline
    .to(av, { prop: "scale.x", from: 0, to: 1, start: 0.45, duration: 0.5, ease: makeOutBack(1.6) })
    .to(av, { prop: "scale.y", from: 0, to: 1, start: 0.45, duration: 0.5, ease: makeOutBack(1.6) });

  // Lower-third: accent tick + name + role.
  const nameSize = fitSize(fonts, name, "display", 700, Math.round(tileW * 0.075), tileW - inset * 2 - tileW * 0.05);
  const roleSize = Math.round(nameSize * 0.62);
  const lt = new Container();
  const tickW = Math.max(4, tileW * 0.012);
  const tickH = nameSize + roleSize * 1.1;
  const ltLeft = -tileW / 2 + inset;
  const baseline = tileH / 2 - inset;
  const roleCy = baseline - roleSize * 0.6;
  const nameCy = roleCy - roleSize * 0.55 - nameSize * 0.55;
  lt.addChild(new Graphics().roundRect(ltLeft, nameCy - nameSize * 0.55, tickW, tickH, tickW / 2).fill(accent));
  const textX = ltLeft + tickW + tileW * 0.03;
  const ltName = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: onTile, anchor: { x: 0, y: 0.5 } });
  ltName.position.set(textX, nameCy);
  lt.addChild(ltName);
  if (role.length > 0) {
    const roleText = makeText(fonts, { text: role, role: "body", weight: 500, size: roleSize, color: onTile, anchor: { x: 0, y: 0.5 } });
    roleText.alpha = 0.78;
    roleText.position.set(textX, roleCy);
    lt.addChild(roleText);
  }
  lt.alpha = 0;
  tile.addChild(lt);
  timeline
    .to(lt, { prop: "alpha", from: 0, to: 1, start: 0.85, duration: 0.45, ease: outQuad })
    .to(lt, { prop: "y", from: minDim * 0.02, to: 0, start: 0.85, duration: 0.5, ease: outExpo });

  // REC indicator + call dots (decorative).
  let recDot: Graphics | null = null;
  if (showREC) {
    const recH = tileH * 0.11;
    const dotR = recH * 0.22;
    const recText = makeText(fonts, { text: "REC", role: "body", weight: 700, size: recH * 0.42, color: onTile, anchor: { x: 0, y: 0.5 }, letterSpacing: 1 });
    const pillPadX = recH * 0.4;
    const recW = pillPadX * 2 + dotR * 2 + recH * 0.3 + recText.width;
    const rec = new Container();
    rec.position.set(-tileW / 2 + inset, -tileH / 2 + inset);
    rec.alpha = 0;
    tile.addChild(rec);
    rec.addChild(new Graphics().roundRect(0, 0, recW, recH, recH / 2).fill({ color: "#000000", alpha: 0.34 }));
    recDot = new Graphics().circle(pillPadX + dotR, recH / 2, dotR).fill(REC_COLOR);
    rec.addChild(recDot);
    recText.position.set(pillPadX + dotR * 2 + recH * 0.3, recH / 2);
    rec.addChild(recText);
    timeline.to(rec, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.4, ease: outQuad });

    // Small call-control dots, bottom-right.
    const dots = new Container();
    dots.position.set(tileW / 2 - inset, tileH / 2 - inset);
    dots.alpha = 0;
    tile.addChild(dots);
    for (let i = 0; i < 3; i++) {
      dots.addChild(new Graphics().circle(-i * recH * 0.5, 0, recH * 0.13).fill({ color: onTile, alpha: 0.5 }));
    }
    timeline.to(dots, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.4, ease: outQuad });
  }

  // Tile entry (slide + fade + settle).
  if (isWide) {
    timeline.to(tile, { prop: "x", from: tileCx - minDim * 0.05, to: tileCx, start: 0.1, duration: 0.55, ease: outExpo });
  } else {
    timeline.to(tile, { prop: "y", from: tileCy - minDim * 0.04, to: tileCy, start: 0.1, duration: 0.55, ease: outExpo });
  }
  timeline
    .to(tile, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad })
    .to(tile, { prop: "scale.x", from: 0.92, to: 1, start: 0.1, duration: 0.55, ease: spring(0.55) })
    .to(tile, { prop: "scale.y", from: 0.92, to: 1, start: 0.1, duration: 0.55, ease: spring(0.55) });

  // --- Pull quote ---
  const markSize = Math.round(minDim * 0.11);
  const mark = makeText(fonts, { text: "“", role: "serif", weight: 600, size: markSize, color: accent, anchor: { x: 0, y: quoteAnchorY } });
  mark.position.set(quoteCx, isWide ? quoteCy - minDim * 0.14 : quoteCy);
  mark.alpha = 0;
  mark.scale.set(0.6);
  root.addChild(mark);
  timeline
    .to(mark, { prop: "alpha", from: 0, to: 0.9, start: 1.05, duration: 0.4, ease: outQuad })
    .to(mark, { prop: "scale.x", from: 0.6, to: 1, start: 1.05, duration: 0.5, ease: makeOutBack(1.8) })
    .to(mark, { prop: "scale.y", from: 0.6, to: 1, start: 1.05, duration: 0.5, ease: makeOutBack(1.8) });

  const quoteSize = Math.round(minDim * (isWide ? 0.05 : 0.052));
  const quoteY = isWide ? quoteCy : quoteCy + markSize * 0.55;
  const quoteBlock = wrapText(fonts, {
    text: quote,
    role: "serif",
    weight: 600,
    size: quoteSize,
    color: textColor,
    width: quoteW,
    lineHeight: Math.round(quoteSize * 1.32),
    align: isWide ? "left" : "center",
    anchor: { x: isWide ? 0 : 0.5, y: quoteAnchorY },
  });
  quoteBlock.position.set(quoteCx, quoteY);
  quoteBlock.alpha = 0;
  root.addChild(quoteBlock);
  timeline
    .to(quoteBlock, { prop: "alpha", from: 0, to: 1, start: 1.25, duration: 0.5, ease: outQuad })
    .to(quoteBlock, { prop: "y", from: quoteY + 16, to: quoteY, start: 1.25, duration: 0.55, ease: outExpo });

  // Pure REC blink (function of t only; no timeline tween touches recDot).
  const update = (t: number): void => {
    if (recDot) recDot.alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.9));
  };

  return { timeline, duration: 4.6, update };
}

export const videoTestimonial: TemplateDefinition = {
  id: "video-testimonial",
  name: "Video Testimonial",
  tagline: "A person tile with a lower-third and REC sits beside a pull-quote.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { name: "display", quote: "serif" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Jordan Lee", maxLength: 24, shrinkToFit: true },
    { key: "role", type: "text", label: "Role", default: "Head of Social", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "quote", type: "textarea", label: "Quote", default: "We ship a week of content in an afternoon now.", maxLength: 120, shrinkToFit: true },
    { key: "showREC", type: "toggle", label: "REC + call UI", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
