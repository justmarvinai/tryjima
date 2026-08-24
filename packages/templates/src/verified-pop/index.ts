import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  shrinkToFit,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const PALETTES: Palette[] = [
  { id: "sky", name: "Sky", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#1D9BF0" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B0F", textColor: "#FFFFFF", accent: "#1D9BF0" } },
  { id: "noir", name: "Noir", colors: { background: "#FAFAFA", textColor: "#101014", accent: "#101014" } },
  { id: "gold", name: "Gold", colors: { background: "#0F0D08", textColor: "#FFF8E7", accent: "#F2B441" } },
];

/** A scalloped seal disc (verified-badge silhouette) with a check mark, centered at origin. */
function makeBadge(R: number, badgeColor: string, onBadge: string): Container {
  const c = new Container();
  c.addChild(new Graphics().star(0, 0, 10, R, R * 0.86).fill(badgeColor));
  c.addChild(new Graphics().circle(0, 0, R * 0.86).fill(badgeColor));
  c.addChild(makeIcon("check", R * 1.05, { color: onBadge }));
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#1D9BF0"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const isDark = luminance(bg) < 0.5;
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const muted = isDark ? "#A9AFB9" : "#6E7079";
  const name = str(values.name, "Your Brand");
  const handle = str(values.handle, "");
  const caption = str(values.caption, "");
  const showRing = values.showRing !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const cy = h * 0.42;

  // --- Name + badge (badge sits beside the name) ---
  const nameBase = Math.round(minDim * 0.076);
  const familyDisplay = fonts.family("display");
  const measureName = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
  const badgeGap = minDim * 0.03;
  const badgeR = nameBase * 0.5;
  const nameMaxW = minDim * 0.78 - badgeGap - badgeR * 2;
  const nameSize = shrinkToFit(name, measureName, { maxWidth: nameMaxW, baseSize: nameBase, minSize: Math.round(nameBase * 0.55) });
  const nameW = measureName(name, nameSize);

  const rowW = nameW + badgeGap + badgeR * 2;
  const rowLeft = cx - rowW / 2;

  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(rowLeft, cy + 16);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
    .to(nameText, { prop: "y", from: cy + 16, to: cy, start: 0.1, duration: 0.5, ease: outExpo });

  const badgeCx = rowLeft + nameW + badgeGap + badgeR;
  const badgeCy = cy - nameSize * 0.02;
  const BADGE_AT = 0.62;

  // Ring flash (drawn behind the badge; its rest state is fully covered until it expands).
  if (showRing) {
    const ring = new Graphics().circle(0, 0, badgeR).stroke({ color: accent, width: Math.max(2, badgeR * 0.09) });
    ring.position.set(badgeCx, badgeCy);
    ring.scale.set(0.8);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0.85, to: 0, start: BADGE_AT, duration: 0.6, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.8, to: 2.0, start: BADGE_AT, duration: 0.6, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.8, to: 2.0, start: BADGE_AT, duration: 0.6, ease: outExpo });
  }

  // Badge (pops in beside the name with a spring).
  const badge = makeBadge(badgeR, accent, onAccent);
  badge.position.set(badgeCx, badgeCy);
  badge.scale.set(0);
  root.addChild(badge);
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: BADGE_AT, duration: 0.55, ease: spring(0.4) })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: BADGE_AT, duration: 0.55, ease: spring(0.4) });

  // --- Handle (below name) ---
  if (handle.length > 0) {
    const handleSize = Math.round(minDim * 0.04);
    const handleY = cy + nameSize * 0.86;
    const handleText = makeText(fonts, { text: handle, role: "body", weight: 500, size: handleSize, color: muted, anchor: 0.5 });
    handleText.position.set(cx, handleY + 12);
    handleText.alpha = 0;
    root.addChild(handleText);
    timeline
      .to(handleText, { prop: "alpha", from: 0, to: 1, start: 0.32, duration: 0.45, ease: outQuad })
      .to(handleText, { prop: "y", from: handleY + 12, to: handleY, start: 0.32, duration: 0.5, ease: outExpo });
  }

  // --- Caption (fades in under, e.g. "Verified") ---
  if (caption.length > 0) {
    const capSize = Math.round(minDim * 0.034);
    const capY = cy + nameSize * (handle.length > 0 ? 1.55 : 0.95);
    const capText = makeText(fonts, {
      text: caption,
      role: "body",
      weight: 600,
      size: capSize,
      color: accent,
      anchor: 0.5,
      letterSpacing: capSize * 0.03,
    });
    capText.position.set(cx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline.to(capText, { prop: "alpha", from: 0, to: 1, start: 1.3, duration: 0.55, ease: outQuad });
  }

  return { timeline, duration: 3.8 };
}

export const verifiedPop: TemplateDefinition = {
  id: "verified-pop",
  name: "Verified",
  tagline: "A verified checkmark springs in beside the name with a ring flash.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.8,
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Your Brand", maxLength: 26, shrinkToFit: true },
    { key: "handle", type: "text", label: "Handle", default: "@yourbrand", maxLength: 24, optional: true },
    { key: "caption", type: "text", label: "Caption", default: "Verified", maxLength: 24, optional: true },
    { key: "showRing", type: "toggle", label: "Ring flash", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Badge", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};
