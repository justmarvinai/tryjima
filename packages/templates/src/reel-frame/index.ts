import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { avatar } from "../shared/ui";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "sunset-ember", name: "Sunset ember", colors: { background: "#2A0E06", blob1: "#FF4D1C", blob2: "#FF2E9E", accent: "#FF6A1A" } },
  { id: "violet-night", name: "Violet night", colors: { background: "#160B2E", blob1: "#7C5CFF", blob2: "#2E7DF6", accent: "#7C5CFF" } },
  { id: "ink", name: "Ink", colors: { background: "#0E0E12", blob1: "#3A3A48", blob2: "#1A1A24", accent: "#FF4D1C" } },
  { id: "berry", name: "Berry", colors: { background: "#2A0820", blob1: "#FF2E9E", blob2: "#7C5CFF", accent: "#FF2E9E" } },
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
    size = Math.max(10, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

/** A tiny two-headed music note, centered near the origin. */
function musicNote(s: number, color: string): Graphics {
  const g = new Graphics();
  g.ellipse(-0.16 * s, 0.3 * s, 0.17 * s, 0.13 * s).fill(color);
  g.ellipse(0.26 * s, 0.2 * s, 0.17 * s, 0.13 * s).fill(color);
  g.rect(-0.02 * s, -0.34 * s, 0.06 * s, 0.66 * s).fill(color);
  g.rect(0.36 * s, -0.44 * s, 0.06 * s, 0.66 * s).fill(color);
  g.poly([-0.02 * s, -0.34 * s, 0.42 * s, -0.44 * s, 0.42 * s, -0.28 * s, -0.02 * s, -0.18 * s]).fill(color);
  return g;
}

function railCenterY(aspect: Aspect, h: number): number {
  switch (aspect) {
    case "9:16":
      return h * 0.62;
    case "1:1":
      return h * 0.55;
    case "4:5":
      return h * 0.57;
    case "16:9":
      return h * 0.52;
  }
}

function textTopY(aspect: Aspect, h: number): number {
  switch (aspect) {
    case "9:16":
      return h * 0.6;
    case "1:1":
      return h * 0.63;
    case "4:5":
      return h * 0.66;
    case "16:9":
      return h * 0.6;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#160B2E"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const white = "#FFFFFF";
  const username = str(values.username, "@jima.studio");
  const caption = str(values.caption, "Make it move ✨ new drop");
  const likes = str(values.likes, "12.4K");
  const comments = str(values.comments, "318");
  const showGlow = values.glow !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  const margin = Math.round(minDim * 0.06);

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();
  const DUR = 4.5;

  // --- Background gradient blobs -----------------------------------------
  if (showGlow) {
    const glowTex = radialGlowTexture();
    const blobSpecs: { tint: string; alpha: number; fx: number; fy: number; drift: number }[] = [
      { tint: pc("blob1", "#7C5CFF"), alpha: 0.6, fx: 0.24, fy: 0.3, drift: 0.05 },
      { tint: pc("blob2", "#2E7DF6"), alpha: 0.5, fx: 0.8, fy: 0.74, drift: 0.06 },
    ];
    for (const spec of blobSpecs) {
      const s = new Sprite(glowTex);
      s.anchor.set(0.5);
      s.tint = spec.tint;
      s.width = maxDim * 0.95;
      s.height = maxDim * 0.95;
      s.alpha = spec.alpha;
      const bx = w * spec.fx;
      const by = h * spec.fy;
      const dr = minDim * spec.drift;
      s.position.set(bx, by);
      root.addChild(s);
      timeline
        .to(s, { prop: "x", from: bx - dr, to: bx + dr, start: 0, duration: DUR / 2, ease: outQuad })
        .to(s, { prop: "x", from: bx + dr, to: bx - dr, start: DUR / 2, duration: DUR / 2, ease: outQuad })
        .to(s, { prop: "y", from: by + dr, to: by - dr, start: 0, duration: DUR / 2, ease: outQuad })
        .to(s, { prop: "y", from: by - dr, to: by + dr, start: DUR / 2, duration: DUR / 2, ease: outQuad });
    }
  }

  // --- Top segmented progress bar ----------------------------------------
  const topY = ctx.aspect === "9:16" ? 130 : Math.round(margin + minDim * 0.02);
  const contentW = w - margin * 2;
  const segGap = contentW * 0.014;
  const segW = (contentW - segGap * 3) / 4;
  const segH = Math.max(5, minDim * 0.008);
  for (let i = 0; i < 4; i++) {
    const sx = margin + i * (segW + segGap);
    root.addChild(new Graphics().roundRect(sx, topY, segW, segH, segH / 2).fill({ color: white, alpha: 0.3 }));
  }
  const fill = new Graphics().roundRect(0, 0, segW, segH, segH / 2).fill(white);
  fill.position.set(margin, topY);
  fill.scale.set(0, 1);
  root.addChild(fill);
  timeline.to(fill, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 3.0, ease: outQuad });

  // --- Right-side action rail --------------------------------------------
  const iconSize = minDim * 0.06;
  const railGap = iconSize * 1.95;
  const railX = w - margin - iconSize * 0.75;
  const railCy = railCenterY(ctx.aspect, h);
  const countSize = Math.round(minDim * 0.03);
  const itemY = (i: number): number => railCy + (i - 2) * railGap;

  const railItems: Container[] = [];
  const makeItem = (build2: (c: Container) => void, i: number): Container => {
    const c = new Container();
    c.position.set(railX, itemY(i));
    build2(c);
    c.scale.set(0);
    root.addChild(c);
    railItems.push(c);
    return c;
  };

  // 0 — avatar with a "+" badge.
  makeItem((c) => {
    const avR = iconSize * 0.5;
    const av = avatar(fonts, { radius: avR, bg: "#D9D9E0", ring: { color: white, width: avR * 0.09 } });
    c.addChild(av);
    const badge = new Container();
    badge.position.set(0, avR * 0.98);
    badge.addChild(new Graphics().circle(0, 0, avR * 0.42).fill(accent));
    badge.addChild(makeIcon("plus", avR * 0.5, { color: white }));
    c.addChild(badge);
  }, 0);

  const addCount = (c: Container, text: string): void => {
    const t = makeText(fonts, { text, role: "body", weight: 600, size: countSize, color: white, anchor: { x: 0.5, y: 0 } });
    t.position.set(0, iconSize * 0.6);
    c.addChild(t);
  };

  // 1 — heart (beats) + likes.
  let heartIcon: Graphics | null = null;
  makeItem((c) => {
    heartIcon = makeIcon("heart", iconSize, { color: white });
    c.addChild(heartIcon);
    addCount(c, likes);
  }, 1);

  // 2 — comment + count.
  makeItem((c) => {
    c.addChild(makeIcon("comment", iconSize, { color: white, holeColor: bg }));
    addCount(c, comments);
  }, 2);

  // 3 — share.
  makeItem((c) => {
    c.addChild(makeIcon("share", iconSize, { color: white }));
  }, 3);

  // 4 — bookmark.
  makeItem((c) => {
    c.addChild(makeIcon("bookmark", iconSize * 0.94, { color: white }));
  }, 4);

  railItems.forEach((c, i) => {
    const start = 0.5 + i * 0.1;
    timeline
      .to(c, { prop: "scale.x", from: 0, to: 1, start, duration: 0.6, ease: spring(0.45) })
      .to(c, { prop: "scale.y", from: 0, to: 1, start, duration: 0.6, ease: spring(0.45) });
  });

  // Heart beat — a couple of gentle pulses after it lands.
  if (heartIcon) {
    const beats: [number, number][] = [[1.7, 1.22], [1.95, 1.0], [2.9, 1.22], [3.15, 1.0]];
    let prev = 1;
    for (const [start, to] of beats) {
      timeline.to(heartIcon, { prop: "scale.x", from: prev, to, start, duration: 0.25, ease: outQuad });
      timeline.to(heartIcon, { prop: "scale.y", from: prev, to, start, duration: 0.25, ease: outQuad });
      prev = to;
    }
  }

  // --- Bottom-left caption block -----------------------------------------
  const leftX = margin;
  const railLeftEdge = railX - iconSize * 0.9;
  const captionMaxW = Math.min(railLeftEdge - leftX, minDim * 1.0);
  const textTop = textTopY(ctx.aspect, h);

  const usernameSize = Math.round(minDim * 0.05);
  const usernameCy = textTop + usernameSize * 0.5;
  const nameText = makeText(fonts, { text: username, role: "display", weight: 700, size: usernameSize, color: white, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(leftX, usernameCy);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.5, ease: outQuad })
    .to(nameText, { prop: "y", from: usernameCy + 14, to: usernameCy, start: 0.15, duration: 0.6, ease: outExpo });

  // Verified dot (accent circle + white check).
  const dotR = usernameSize * 0.3;
  const verified = new Container();
  verified.position.set(leftX + nameText.width + usernameSize * 0.42, usernameCy);
  verified.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
  verified.addChild(makeIcon("check", dotR * 1.5, { color: white }));
  verified.scale.set(0);
  root.addChild(verified);
  timeline
    .to(verified, { prop: "scale.x", from: 0, to: 1, start: 0.45, duration: 0.5, ease: spring(0.4) })
    .to(verified, { prop: "scale.y", from: 0, to: 1, start: 0.45, duration: 0.5, ease: spring(0.4) });

  // Caption (1–2 lines, shrink to fit).
  const captionSize0 = Math.round(minDim * 0.045);
  const { lines: capLines, size: capSize } = wrapAndFit(fonts, caption, "body", 500, captionSize0, captionMaxW, 2);
  const capLH = Math.round(capSize * 1.22);
  const capTop = usernameCy + usernameSize * 0.6 + minDim * 0.022;
  const capText = makeText(fonts, {
    text: capLines.join("\n"),
    role: "body",
    weight: 500,
    size: capSize,
    color: white,
    anchor: { x: 0, y: 0 },
    lineHeight: capLH,
  });
  capText.position.set(leftX, capTop);
  capText.alpha = 0;
  root.addChild(capText);
  timeline
    .to(capText, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.5, ease: outQuad })
    .to(capText, { prop: "y", from: capTop + 14, to: capTop, start: 0.35, duration: 0.6, ease: outExpo });

  // Audio ticker row (album + note + "Original audio").
  const capBlockH = capLines.length * capLH;
  const audioR = minDim * 0.028;
  const audioCy = capTop + capBlockH + minDim * 0.03 + audioR;
  const audioRow = new Container();
  audioRow.position.set(leftX, audioCy);
  const album = new Container();
  album.position.set(audioR, 0);
  album.addChild(new Graphics().roundRect(-audioR, -audioR, audioR * 2, audioR * 2, audioR * 0.4).fill(accent));
  album.addChild(musicNote(audioR * 1.25, white));
  audioRow.addChild(album);
  const audioText = makeText(fonts, { text: "Original audio", role: "body", weight: 500, size: Math.round(minDim * 0.034), color: white, anchor: { x: 0, y: 0.5 } });
  audioText.position.set(audioR * 2 + minDim * 0.02, 0);
  audioRow.addChild(audioText);
  audioRow.alpha = 0;
  root.addChild(audioRow);
  timeline
    .to(audioRow, { prop: "alpha", from: 0, to: 1, start: 0.65, duration: 0.5, ease: outQuad })
    .to(audioRow, { prop: "x", from: leftX - 28, to: leftX, start: 0.65, duration: 0.6, ease: outExpo });
  // Note bob.
  timeline
    .to(album, { prop: "rotation", from: -0.08, to: 0.08, start: 1.4, duration: 0.9, ease: outQuad })
    .to(album, { prop: "rotation", from: 0.08, to: -0.08, start: 2.3, duration: 0.9, ease: outQuad })
    .to(album, { prop: "rotation", from: -0.08, to: 0.05, start: 3.2, duration: 0.9, ease: outQuad });

  return { timeline, duration: DUR };
}

export const reelFrame: TemplateDefinition = {
  id: "reel-frame",
  name: "Reel Frame",
  tagline: "A vertical reel UI — action rail pops in, the heart beats, caption rises.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "username", type: "text", label: "Username", default: "@jima.studio", maxLength: 24 },
    { key: "caption", type: "text", label: "Caption", default: "Make it move ✨ new drop", maxLength: 90, shrinkToFit: true },
    { key: "likes", type: "text", label: "Likes", default: "12.4K", maxLength: 10 },
    { key: "comments", type: "text", label: "Comments", default: "318", maxLength: 10 },
    { key: "glow", type: "toggle", label: "Glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
