import { Container, Graphics } from "pixi.js";
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
import { makeIcon } from "../shared/icons";
import { avatar } from "../shared/ui";

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
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#0F0F0F", accent: "#FF0033", muted: "#E9E9E9" } },
  { id: "dark", name: "Dark", colors: { background: "#0F0F0F", textColor: "#FFFFFF", accent: "#FF0033", muted: "#272727" } },
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#ECECEC" } },
  { id: "night-ember", name: "Night ember", colors: { background: "#141414", textColor: "#FFFFFF", accent: "#FF4D1C", muted: "#2A2A2A" } },
];

/** Card width as a fraction of the frame — narrower on wide 16:9, fuller in portrait. */
function cardWidthFor(aspect: Aspect, w: number): number {
  switch (aspect) {
    case "16:9":
      return Math.min(w * 0.46, 900);
    case "1:1":
      return w * 0.72;
    case "4:5":
      return w * 0.74;
    case "9:16":
      return w * 0.8;
  }
}

/** Greedy-wrap into ≤ maxLines lines, then shrink the size so the widest line fits. */
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

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#0F0F0F"));
  const accent = str(values.accent, pc("accent", "#FF0033"));
  const muted = pc("muted", "#E9E9E9");
  const isDark = luminance(bg) < 0.5;
  const grey = isDark ? "#AAAAAA" : "#606060";
  const iconGrey = isDark ? "#DDDDDD" : "#5A5A5A";

  const title = str(values.title, "How we made this in 60 seconds");
  const channel = str(values.channel, "Jima Studio");
  const views = str(values.views, "1.2M views · 2d");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  const timeline = new JimaTimeline();

  // --- Card metrics -------------------------------------------------------
  const W = cardWidthFor(ctx.aspect, size.width);
  const thumbH = W * 0.5625; // 16:9 thumbnail
  const pad = W * 0.045;
  const r = W * 0.032;

  // Title (2 lines, shrink to fit the card width).
  const titleSize0 = Math.round(W * 0.066);
  const { lines: titleLines, size: titleSize } = wrapAndFit(fonts, title, "display", 700, titleSize0, W, 2);
  const titleLH = Math.round(titleSize * 1.16);
  const titleBlockH = titleLines.length * titleLH;

  const avatarR = W * 0.052;
  const nameSize = Math.round(W * 0.044);
  const viewsSize = Math.round(W * 0.036);
  const actionIcon = W * 0.058;

  // Vertical walk to size the whole card, then center it in the safe band.
  let y = thumbH + pad * 1.15;
  const titleTop = y;
  y += titleBlockH;
  y += pad * 0.7;
  const channelCy = y + avatarR;
  y = channelCy + avatarR;
  y += pad * 0.95;
  const actionsCy = y + actionIcon / 2;
  const totalH = actionsCy + actionIcon / 2;

  const centerY = ctx.aspect === "9:16" ? 220 + (size.height - 220 - 400) / 2 : size.height / 2;
  const card = new Container();
  card.position.set((size.width - W) / 2, centerY - totalH / 2);
  root.addChild(card);

  // --- Thumbnail (with play button, progress bar, duration pill) ----------
  const thumb = new Container();
  card.addChild(thumb);
  thumb.addChild(new Graphics().roundRect(0, 0, W, thumbH, r).fill(muted));

  // Progress track + red fill hugging the bottom edge.
  const barH = Math.max(4, thumbH * 0.018);
  const barInset = r;
  const barW = W - barInset * 2;
  const barY = thumbH - barH - Math.max(2, thumbH * 0.02);
  thumb
    .addChild(new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(isDark ? "#3A3A3A" : "#C8C8C8")).position.set(barInset, barY);
  const barFill = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(accent);
  barFill.position.set(barInset, barY);
  barFill.scale.set(0, 1);
  thumb.addChild(barFill);

  // Duration pill (bottom-right, above the progress bar).
  const durPill = new Container();
  const durSize = Math.round(W * 0.03);
  const durText = makeText(fonts, { text: "1:00", role: "body", weight: 600, size: durSize, color: "#FFFFFF", anchor: { x: 1, y: 1 } });
  const dpW = durText.width + durSize * 0.9;
  const dpH = durSize + durSize * 0.55;
  durPill.addChild(new Graphics().roundRect(-dpW, -dpH, dpW, dpH, dpH * 0.28).fill({ color: "#000000", alpha: 0.78 }));
  durText.position.set(-durSize * 0.45, -durSize * 0.28);
  durPill.addChild(durText);
  durPill.position.set(W - barInset, barY - barH * 0.6);
  thumb.addChild(durPill);

  // Play button — red rounded rectangle + white triangle, gently pulsing.
  const playBtn = new Container();
  playBtn.position.set(W / 2, thumbH / 2);
  const bw = thumbH * 0.3;
  const bh = thumbH * 0.21;
  playBtn.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bh * 0.3).fill(accent));
  const playIcon = makeIcon("play", bh * 0.52, { color: "#FFFFFF" });
  playIcon.position.set(-bh * 0.52 * 0.08, 0);
  playBtn.addChild(playIcon);
  playBtn.scale.set(0);
  thumb.addChild(playBtn);

  // Thumbnail entrance (fade + tiny rise).
  thumb.alpha = 0;
  timeline
    .to(thumb, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.45, ease: outQuad })
    .to(thumb, { prop: "y", from: -14, to: 0, start: 0.0, duration: 0.55, ease: outExpo });

  // Play button pops, then a gentle looping pulse.
  timeline
    .to(playBtn, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.6, ease: spring(0.42) })
    .to(playBtn, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.6, ease: spring(0.42) });
  const pulses: [number, number][] = [[1.5, 1.06], [1.85, 1.0], [2.55, 1.06], [2.9, 1.0], [3.6, 1.06]];
  let prev = 1;
  for (const [start, to] of pulses) {
    timeline.to(playBtn, { prop: "scale.x", from: prev, to, start, duration: 0.35, ease: outQuad });
    timeline.to(playBtn, { prop: "scale.y", from: prev, to, start, duration: 0.35, ease: outQuad });
    prev = to;
  }

  // Progress bar fills to ~60%.
  timeline.to(barFill, { prop: "scale.x", from: 0, to: 0.6, start: 0.55, duration: 1.5, ease: outCubic });

  // --- Title (rises in) ---------------------------------------------------
  const titleText = makeText(fonts, {
    text: titleLines.join("\n"),
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0, y: 0 },
    lineHeight: titleLH,
  });
  titleText.position.set(0, titleTop);
  titleText.alpha = 0;
  card.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleTop + 18, to: titleTop, start: 0.55, duration: 0.6, ease: outExpo });

  // --- Channel row (avatar + name + views) --------------------------------
  const channelRow = new Container();
  const av = avatar(fonts, { radius: avatarR, bg: accent, initial: channel.charAt(0).toUpperCase(), textColor: "#FFFFFF" });
  av.position.set(avatarR, channelCy);
  channelRow.addChild(av);
  const metaX = avatarR * 2 + pad * 0.55;
  const nameText = makeText(fonts, { text: channel, role: "display", weight: 600, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(metaX, channelCy - viewsSize * 0.72);
  channelRow.addChild(nameText);
  const viewsText = makeText(fonts, { text: views, role: "body", weight: 400, size: viewsSize, color: grey, anchor: { x: 0, y: 0.5 } });
  viewsText.position.set(metaX, channelCy + nameSize * 0.62);
  channelRow.addChild(viewsText);
  channelRow.alpha = 0;
  card.addChild(channelRow);
  timeline
    .to(channelRow, { prop: "alpha", from: 0, to: 1, start: 0.85, duration: 0.5, ease: outQuad })
    .to(channelRow, { prop: "y", from: 16, to: 0, start: 0.85, duration: 0.6, ease: outExpo });

  // --- Actions row (thumb + count + share) --------------------------------
  const actionsRow = new Container();
  actionsRow.position.set(0, actionsCy);
  const thumbUp = makeIcon("thumb", actionIcon, { color: iconGrey });
  thumbUp.position.set(actionIcon / 2, 0);
  actionsRow.addChild(thumbUp);
  const countSize = Math.round(W * 0.038);
  const countText = makeText(fonts, { text: "2.4K", role: "body", weight: 500, size: countSize, color: grey, anchor: { x: 0, y: 0.5 } });
  countText.position.set(actionIcon + pad * 0.4, 0);
  actionsRow.addChild(countText);
  const shareX = actionIcon + pad * 0.4 + countText.width + pad * 1.1 + actionIcon / 2;
  const shareIcon = makeIcon("share", actionIcon, { color: iconGrey });
  shareIcon.position.set(shareX, 0);
  actionsRow.addChild(shareIcon);
  actionsRow.alpha = 0;
  card.addChild(actionsRow);
  timeline
    .to(actionsRow, { prop: "alpha", from: 0, to: 1, start: 1.05, duration: 0.5, ease: outQuad })
    .to(actionsRow, { prop: "y", from: actionsCy + 16, to: actionsCy, start: 1.05, duration: 0.6, ease: outExpo });

  return { timeline, duration: 4.0 };
}

export const youtubeFrame: TemplateDefinition = {
  id: "youtube-frame",
  name: "YouTube Frame",
  tagline: "A video card assembles — thumbnail, play button, title and channel.",
  category: "social",
  aspects: ["16:9", "1:1", "4:5", "9:16"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "How we made this in 60 seconds", maxLength: 70, shrinkToFit: true },
    { key: "channel", type: "text", label: "Channel", default: "Jima Studio", maxLength: 24 },
    { key: "views", type: "text", label: "Views", default: "1.2M views · 2d", maxLength: 30 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
