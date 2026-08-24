import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { avatar } from "../shared/ui";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const DEFAULT_COMMENTS = ["Sam: this is 🔥", "Alex: how did you make this?", "Mia: saving this!"];
const PER = 0.9;
const AVATAR_COLORS = ["#FF4D1C", "#7C5CFF", "#2E7DF6", "#17A34A", "#FF2E9E", "#F59E0B", "#0EA5C4", "#FF6A3D"];

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#EEF0F3", textColor: "#101014", accent: "#FF4D1C", bubble: "#FFFFFF" } },
  { id: "dark", name: "Dark", colors: { background: "#0E0E12", textColor: "#FFFFFF", accent: "#FF6A3D", bubble: "#1C1C22" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7F0", textColor: "#08221A", accent: "#17A34A", bubble: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F1ECFF", textColor: "#1E1140", accent: "#7C5CFF", bubble: "#FFFFFF" } },
];

function items(values: Values): string[] {
  return asItems(values.comments, DEFAULT_COMMENTS).slice(0, 4);
}
function computeDuration(values: Values): number {
  return items(values).length * PER + 1.6;
}

/** Split "Name: message" once; otherwise a generic name + whole message. */
function parseComment(raw: string): { name: string; message: string } {
  const idx = raw.indexOf(": ");
  if (idx > 0) {
    const name = raw.slice(0, idx).trim();
    const message = raw.slice(idx + 2).trim();
    if (name.length > 0 && message.length > 0) return { name, message };
  }
  return { name: "Guest", message: raw.trim() };
}

/** Greedy word-wrap to maxLines, shrinking the size until the widest line fits. */
function wrapAndFit(
  fonts: TemplateContext["fonts"],
  text: string,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family("body");
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

function bubbleMaxFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.5 : 0.66;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF0F3"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const bubbleColor = pc("bubble", "#FFFFFF");
  const showLikeHeart = values.likeHeart !== false;
  const list = items(values);
  const N = list.length;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  const timeline = new JimaTimeline();

  const minDim = Math.min(size.width, size.height);
  const k = minDim / 1080;
  const avatarR = 44 * k;
  const avatarGap = 22 * k;
  const bubbleLeft = avatarR * 2 + avatarGap;
  const padX = 30 * k;
  const padY = 24 * k;
  const gapUM = 10 * k;
  const unameSize = Math.round(30 * k);
  const msgSize0 = Math.round(37 * k);
  const unameLH = unameSize * 1.15;
  const G = 26 * k;

  const marginX = Math.max(size.width * 0.06, 40);
  const contentW = size.width - marginX * 2;
  const bubbleMaxW = Math.min(contentW - bubbleLeft, size.width * bubbleMaxFrac(ctx.aspect));
  const textMaxW = bubbleMaxW - padX * 2;

  const safeBottom = ctx.aspect === "9:16" ? 400 : Math.round(minDim * 0.06);
  const bottomAnchorY = size.height - safeBottom - 10 * k;

  const rows: Container[] = [];
  const hearts: Graphics[] = [];
  const heights: number[] = [];

  list.forEach((raw) => {
    const { name, message } = parseComment(raw);
    const { lines, size: msgSize } = wrapAndFit(fonts, message, 500, msgSize0, textMaxW, 3);
    const msgLH = Math.round(msgSize * 1.32);
    const nameW = fonts.measure(name, { family: fonts.family("display"), weight: 700, size: unameSize });
    const lineW = Math.max(...lines.map((l) => fonts.measure(l, { family: fonts.family("body"), weight: 500, size: msgSize })));
    const innerW = Math.min(textMaxW, Math.max(nameW, lineW));
    const bubbleW = innerW + padX * 2;
    const bubbleH = padY + unameLH + gapUM + lines.length * msgLH + padY;
    heights.push(bubbleH);

    const c = new Container();

    // Avatar chip (left), rng-picked on-brand color.
    const av = avatar(fonts, { radius: avatarR, bg: rng.pick(AVATAR_COLORS), initial: (name.charAt(0) || "?").toUpperCase(), textColor: "#FFFFFF" });
    av.position.set(avatarR, bubbleH / 2);
    c.addChild(av);

    // Bubble + little tail pointing at the avatar.
    const midY = bubbleH * 0.5;
    const bub = new Graphics().roundRect(bubbleLeft, 0, bubbleW, bubbleH, Math.min(bubbleH / 2, 26 * k)).fill(bubbleColor);
    bub.poly([bubbleLeft, midY - 12 * k, bubbleLeft - 12 * k, midY, bubbleLeft, midY + 12 * k]).fill(bubbleColor);
    c.addChild(bub);

    const un = makeText(fonts, { text: name, role: "display", weight: 700, size: unameSize, color: textColor, anchor: { x: 0, y: 0 } });
    un.position.set(bubbleLeft + padX, padY * 0.85);
    c.addChild(un);

    const msg = makeText(fonts, { text: lines.join("\n"), role: "body", weight: 500, size: msgSize, color: textColor, anchor: { x: 0, y: 0 }, lineHeight: msgLH });
    msg.position.set(bubbleLeft + padX, padY * 0.85 + unameLH + gapUM);
    c.addChild(msg);

    // Accent "like" heart in the bubble's bottom-right corner.
    const heart = makeIcon("heart", msgSize0 * 0.8, { color: accent });
    heart.position.set(bubbleLeft + bubbleW - padX * 0.7, bubbleH - padY * 0.7);
    heart.scale.set(0);
    if (showLikeHeart) c.addChild(heart);

    c.position.set(marginX, bottomAnchorY - bubbleH);
    c.alpha = 0;
    root.addChild(c);
    rows.push(c);
    hearts.push(heart);
  });

  // Top edge of bubble i once bubbles 0..p have arrived (newest sits at the bottom).
  const topEdgeAt = (i: number, p: number): number => {
    let below = 0;
    for (let j = i + 1; j <= p; j++) below += heights[j]! + G;
    return bottomAnchorY - below - heights[i]!;
  };

  const START0 = 0.5;
  rows.forEach((c, i) => {
    const Ti = START0 + i * PER;
    const restTop = topEdgeAt(i, i);
    c.position.set(marginX, restTop + 70 * k);
    timeline
      .to(c, { prop: "alpha", from: 0, to: 1, start: Ti, duration: 0.4, ease: outQuad })
      .to(c, { prop: "y", from: restTop + 70 * k, to: restTop, start: Ti, duration: 0.6, ease: spring(0.5) });

    const heart = hearts[i]!;
    if (showLikeHeart) {
      timeline
        .to(heart, { prop: "scale.x", from: 0, to: 1, start: Ti + 0.28, duration: 0.45, ease: makeOutBack(2) })
        .to(heart, { prop: "scale.y", from: 0, to: 1, start: Ti + 0.28, duration: 0.45, ease: makeOutBack(2) });
    }

    // Push up as each later comment lands.
    for (let p = i + 1; p < N; p++) {
      const Tp = START0 + p * PER;
      timeline.to(c, { prop: "y", from: topEdgeAt(i, p - 1), to: topEdgeAt(i, p), start: Tp, duration: 0.5, ease: outQuint });
    }
  });

  return { timeline, duration: computeDuration(values) };
}

export const commentDrop: TemplateDefinition = {
  id: "comment-drop",
  name: "Comment Drop",
  tagline: "A live comment feed that stacks up one bubble at a time.",
  category: "social",
  aspects: ["4:5", "1:1", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "comments", type: "textlist", label: "Comments", default: DEFAULT_COMMENTS, minItems: 2, maxItems: 4, maxLength: 60 },
    { key: "likeHeart", type: "toggle", label: "Like heart", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
