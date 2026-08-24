import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "fresh-white", name: "Fresh white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", onAccent: "#FFFFFF" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A" } },
];

/** Greedy-wrap into ≤ maxLines lines, then shrink so the widest line fits. */
function wrapAndFit(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(12, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

/** Rounded product frame: cover-fit masked image, or a designed placeholder. */
function productFrame(side: number, r: number, tex: Texture | null, cardColor: string, accent: string): Container {
  const c = new Container();
  c.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(cardColor));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(side / tex.width, side / tex.height);
    s.scale.set(cover);
    const mask = new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    c.addChild(new Graphics().circle(0, 0, side * 0.34).fill({ color: accent, alpha: 0.12 }));
    c.addChild(new Graphics().circle(0, 0, side * 0.24).fill({ color: accent, alpha: 0.2 }));
    const bw = side * 0.3;
    const bh = side * 0.42;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  return c;
}

function frameSideFor(aspect: Aspect, w: number, h: number): number {
  switch (aspect) {
    case "16:9":
      return h * 0.5;
    case "1:1":
      return w * 0.58;
    case "4:5":
      return w * 0.6;
    case "9:16":
      return w * 0.66;
  }
}

function nameSizeFor(aspect: Aspect, w: number): number {
  switch (aspect) {
    case "16:9":
      return Math.round(w * 0.05);
    case "9:16":
      return Math.round(w * 0.086);
    default:
      return Math.round(w * 0.078);
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const badgeText = str(values.badgeText, "NEW").toUpperCase();
  const name = str(values.name, "Summer Collection");
  const cta = str(values.cta, "Shop the drop");

  const W = size.width;
  const H = size.height;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();
  const DUR = 4.0;

  // --- Layout (centered vertical stack) ---
  const cx = W / 2;
  const side = frameSideFor(ctx.aspect, W, H);
  const frameR = side * 0.09;
  const marginX = Math.round(Math.min(W, H) * 0.06);
  const textW = W - marginX * 2;
  const nameSize0 = nameSizeFor(ctx.aspect, W);
  const { lines: nameLines, size: nameSize } = wrapAndFit(fonts, name, "display", 700, nameSize0, textW, 2);
  const nameLH = Math.round(nameSize * 1.08);
  const nameBlockH = nameLines.length * nameLH;
  const ctaSize = Math.round(nameSize0 * 0.62);
  const ctaH = ctaSize * 2.0;
  const gap1 = Math.min(W, H) * 0.055;
  const gap2 = Math.min(W, H) * 0.04;
  const totalH = side + gap1 + nameBlockH + gap2 + ctaH;

  const centerY = ctx.aspect === "9:16" ? 220 + (H - 220 - 400) / 2 : H / 2;
  const top = centerY - totalH / 2;
  const frameCy = top + side / 2;

  // --- Energetic accent ring flash behind the frame ---
  const showGlow = values.glow !== false;
  if (showGlow) {
    const ring = new Graphics().circle(0, 0, side * 0.62).stroke({ color: accent, width: Math.max(3, side * 0.02) });
    ring.position.set(cx, frameCy);
    ring.scale.set(0.6);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 0.5, start: 0.25, duration: 0.2, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.5, to: 0, start: 0.45, duration: 0.5, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.6, to: 1.5, start: 0.25, duration: 0.7, ease: outCubic })
      .to(ring, { prop: "scale.y", from: 0.6, to: 1.5, start: 0.25, duration: 0.7, ease: outCubic });
  }

  // --- Product frame (scale/alpha reveal) ---
  const frame = productFrame(side, frameR, images.product ?? null, cardColor, accent);
  frame.position.set(cx, frameCy);
  frame.scale.set(0.82);
  frame.alpha = 0;
  root.addChild(frame);
  timeline
    .to(frame, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.35, ease: outQuad })
    .to(frame, { prop: "scale.x", from: 0.82, to: 1, start: 0.2, duration: 0.8, ease: spring(0.5) })
    .to(frame, { prop: "scale.y", from: 0.82, to: 1, start: 0.2, duration: 0.8, ease: spring(0.5) });

  // --- "NEW" starburst badge at the top-right corner ---
  const showBadge = values.badge !== false;
  if (showBadge) {
    const badgeR = side * 0.17;
    const badge = new Container();
    badge.position.set(cx + side / 2 - badgeR * 0.35, frameCy - side / 2 + badgeR * 0.35);
    const burst = new Graphics().star(0, 0, 12, badgeR, badgeR * 0.8).fill(accent);
    badge.addChild(burst);
    badge.addChild(new Graphics().circle(0, 0, badgeR * 0.82).fill(accent));
    const badgeLabel = makeText(fonts, { text: badgeText, role: "display", weight: 700, size: Math.round(badgeR * 0.5), color: onAccent, anchor: 0.5, letterSpacing: 1 });
    badge.addChild(badgeLabel);
    badge.scale.set(0);
    root.addChild(badge);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.6, duration: 0.6, ease: spring(0.42) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.6, duration: 0.6, ease: spring(0.42) })
      // pulse beats
      .to(badge, { prop: "scale.x", from: 1, to: 1.08, start: 1.7, duration: 0.24, ease: outQuad })
      .to(badge, { prop: "scale.y", from: 1, to: 1.08, start: 1.7, duration: 0.24, ease: outQuad })
      .to(badge, { prop: "scale.x", from: 1.08, to: 1, start: 1.94, duration: 0.3, ease: outQuad })
      .to(badge, { prop: "scale.y", from: 1.08, to: 1, start: 1.94, duration: 0.3, ease: outQuad })
      .to(badge, { prop: "scale.x", from: 1, to: 1.08, start: 3.0, duration: 0.24, ease: outQuad })
      .to(badge, { prop: "scale.y", from: 1, to: 1.08, start: 3.0, duration: 0.24, ease: outQuad })
      .to(badge, { prop: "scale.x", from: 1.08, to: 1, start: 3.24, duration: 0.3, ease: outQuad })
      .to(badge, { prop: "scale.y", from: 1.08, to: 1, start: 3.24, duration: 0.3, ease: outQuad });
    // Gentle continuous spin of the starburst rays (text stays upright).
    timeline.to(burst, { prop: "rotation", from: 0, to: Math.PI * 0.5, start: 0.6, duration: DUR - 0.6, ease: outQuad });
  }

  // --- Name ---
  const nameY = top + side + gap1;
  const nameText = makeText(fonts, { text: nameLines.join("\n"), role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0.5, y: 0 }, lineHeight: nameLH, align: "center" });
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 1.3, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 18, to: nameY, start: 1.3, duration: 0.6, ease: outExpo });

  // --- CTA pill ---
  if (cta.length > 0) {
    const ctaC = new Container();
    const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
    const pillW = ctaLabel.width + ctaSize * 1.5;
    ctaC.addChild(new Graphics().roundRect(-pillW / 2, -ctaH / 2, pillW, ctaH, ctaH / 2).fill(accent));
    ctaC.addChild(ctaLabel);
    const ctaCy = nameY + nameBlockH + gap2 + ctaH / 2;
    ctaC.position.set(cx, ctaCy);
    ctaC.scale.set(0);
    root.addChild(ctaC);
    timeline
      .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 1.7, duration: 0.6, ease: spring(0.45) })
      .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 1.7, duration: 0.6, ease: spring(0.45) })
      .to(ctaC, { prop: "scale.x", from: 1, to: 1.04, start: 3.0, duration: 0.45, ease: outQuad })
      .to(ctaC, { prop: "scale.x", from: 1.04, to: 1, start: 3.45, duration: 0.45, ease: outQuad });
  }

  return { timeline, duration: DUR };
}

export const newArrival: TemplateDefinition = {
  id: "new-arrival",
  name: "New Arrival",
  tagline: "A spinning NEW badge crowns a product reveal.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Fills the frame; a clean product photo works best." },
    { key: "badgeText", type: "text", label: "Badge", default: "NEW", maxLength: 10 },
    { key: "name", type: "text", label: "Name", default: "Summer Collection", maxLength: 30, shrinkToFit: true },
    { key: "cta", type: "text", label: "Button", default: "Shop the drop", maxLength: 20 },
    { key: "glow", type: "toggle", label: "Glow", default: true },
    { key: "badge", type: "toggle", label: "Badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
