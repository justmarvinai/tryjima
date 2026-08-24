import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  outCubic,
  spring,
  fitBox,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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

const DEFAULT_COMMENTS = [
  "@vault|bro when is the update coming, it's been 6 weeks now…|2.8k",
  "@username|honestly the fastest editor I've tried so far \u{1F525}|4.1k",
];
const TIMESTAMPS = ["6mo", "3mo", "5w"];
const AVATAR_COLORS = ["#FF4D1C", "#7C5CFF", "#2E7DF6", "#F59E0B", "#FF2E9E", "#0EA5C4"];

const PALETTES: Palette[] = [
  { id: "daylight", name: "Daylight", colors: { background: "#F3F4F7", card: "#FFFFFF", textColor: "#101014", accent: "#17C964" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", card: "#1C1C22", textColor: "#FFFFFF", accent: "#33E2A0" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF3FF", card: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#150F24", card: "#241934", textColor: "#FFFFFF", accent: "#B084F5" } },
];

interface ParsedComment {
  user: string;
  text: string;
  likes: string;
}

/** Parse "@user | comment text | likes" — forgiving of missing parts. */
function parseCommentItem(raw: string): ParsedComment {
  const parts = raw.split("|");
  if (parts.length >= 2) {
    const userRaw = (parts[0] ?? "").trim();
    const user = userRaw.length > 0 ? (userRaw.startsWith("@") ? userRaw : `@${userRaw}`) : "@user";
    const text = (parts[1] ?? "").trim();
    const likes = (parts[2] ?? "").trim() || "86";
    return { user, text: text.length > 0 ? text : raw.trim(), likes };
  }
  return { user: "@user", text: raw.trim(), likes: "86" };
}

function commentsOf(values: Values): string[] {
  return asItems(values.comments, DEFAULT_COMMENTS).slice(0, 3);
}

/** Parse a compact "2.8k" / "4.1m" style string into its numeric magnitude. */
function parseCompactNumber(raw: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*([kKmM]?)/.exec(raw.trim());
  if (!m) return 0;
  const n = Number(m[1] ?? "0");
  const suffix = (m[2] ?? "").toLowerCase();
  if (suffix === "k") return n * 1000;
  if (suffix === "m") return n * 1_000_000;
  return n;
}

function trimDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Format a number back into compact "2.8k" / "4.1m" notation. */
function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimDecimal(n / 1_000_000)}m`;
  if (abs >= 1000) return `${trimDecimal(n / 1000)}k`;
  return String(Math.round(n));
}

/** A tiny left-pointing "reply" arrow, tip at the left, centered at (0,0). */
function replyGlyph(size: number, color: string): Graphics {
  const s = size;
  return new Graphics()
    .moveTo(0.42 * s, 0)
    .lineTo(-0.3 * s, 0)
    .stroke({ color, width: Math.max(2, 0.16 * s), cap: "round" })
    .poly([-0.16 * s, -0.26 * s, -0.5 * s, 0, -0.16 * s, 0.26 * s])
    .fill(color);
}

interface RowInfo {
  user: string;
  likes: string;
  timestamp: string;
  avatarColor: string;
  lines: string[];
  msgSize: number;
  msgLH: number;
  h: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3F4F7"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#17C964"));
  const card = pc("card", "#FFFFFF");
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const showNew = values.showNew !== false;
  const list = commentsOf(values);
  const N = list.length;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const k = minDim / 1080;
  const safe = safeRect(ctx.aspect);

  const cardW = safe.width;
  const cardX = safe.x;
  const padX = 30 * k;
  const padY = 24 * k;
  const avatarR = 40 * k;
  const avatarGap = 18 * k;
  const textLeft = padX + avatarR * 2 + avatarGap;
  const textMaxW = cardW - textLeft - padX;
  const unameSize = Math.round(30 * k);
  const timeSize = Math.round(24 * k);
  const nameLineH = Math.round(unameSize * 1.25);
  const gapNameMsg = 12 * k;
  const msgSize0 = Math.round(32 * k);
  const gapMsgFooter = 16 * k;
  const footerIconSize = Math.round(27 * k);
  const footerTextSize = Math.round(25 * k);
  const footerH = 34 * k;
  const cardGap = 22 * k;
  const cardRadius = 26 * k;

  const familyBody = fonts.family("body");
  const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 500, size: sz });

  const rows: RowInfo[] = list.map((raw, i) => {
    const { user, text, likes } = parseCommentItem(raw);
    const { fontSize: msgSize, lines } = fitBox(text, measureBody, {
      maxWidth: textMaxW,
      baseSize: msgSize0,
      minSize: Math.round(msgSize0 * 0.68),
      maxLines: 2,
    });
    const msgLH = Math.round(msgSize * 1.32);
    const h = padY * 2 + nameLineH + gapNameMsg + lines.length * msgLH + gapMsgFooter + footerH;
    return { user, likes, timestamp: TIMESTAMPS[i % TIMESTAMPS.length]!, avatarColor: rng.pick(AVATAR_COLORS), lines, msgSize, msgLH, h };
  });

  const totalRowsH = rows.reduce((acc, r) => acc + r.h, 0) + cardGap * Math.max(0, N - 1);
  const topPad = showNew ? 58 * k : 0;
  const areaTop = safe.y + topPad;
  const areaH = safe.height - topPad;
  const stackTop = areaTop + Math.max(0, (areaH - totalRowsH) / 2);

  const tops: number[] = [];
  let cursorY = stackTop;
  for (const r of rows) {
    tops.push(cursorY);
    cursorY += r.h + cardGap;
  }

  const riseAmt = 44 * k;

  const tick: { node: Text | null; target: number; startVal: number; winStart: number; winEnd: number } = {
    node: null,
    target: 0,
    startVal: 0,
    winStart: 0,
    winEnd: 0,
  };

  rows.forEach((r, i) => {
    const restTop = tops[i]!;
    const c = new Container();

    // Soft shadow + card.
    c.addChild(new Graphics().roundRect(0, 6 * k, cardW, r.h, cardRadius).fill({ color: "#000000", alpha: 0.12 }));
    c.addChild(new Graphics().roundRect(0, 0, cardW, r.h, cardRadius).fill(card));

    // Avatar chip (colored disc + user glyph).
    const av = new Container();
    av.addChild(new Graphics().circle(0, 0, avatarR).fill(r.avatarColor));
    av.addChild(makeIcon("user", avatarR * 1.15, { color: "#FFFFFF" }));
    av.position.set(padX + avatarR, r.h / 2);
    c.addChild(av);

    // Username + muted timestamp, same baseline.
    const nameY = padY + nameLineH / 2;
    const uname = makeText(fonts, { text: r.user, role: "display", weight: 700, size: unameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    uname.position.set(textLeft, nameY);
    c.addChild(uname);
    const ts = makeText(fonts, { text: ` · ${r.timestamp}`, role: "body", weight: 500, size: timeSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    ts.alpha = 0.5;
    ts.position.set(textLeft + uname.width, nameY + 1 * k);
    c.addChild(ts);

    // Comment text (wraps to <=2 lines).
    const msg = makeText(fonts, {
      text: r.lines.join("\n"),
      role: "body",
      weight: 500,
      size: r.msgSize,
      color: textColor,
      anchor: { x: 0, y: 0 },
      lineHeight: r.msgLH,
    });
    msg.position.set(textLeft, padY + nameLineH + gapNameMsg);
    c.addChild(msg);

    // Footer: heart + like count, then a reply glyph + label.
    const footerY = padY + nameLineH + gapNameMsg + r.lines.length * r.msgLH + gapMsgFooter + footerH / 2;
    const heart = makeIcon("heart", footerIconSize, { color: accent });
    heart.position.set(textLeft + footerIconSize * 0.5, footerY);
    heart.scale.set(0);
    c.addChild(heart);

    const likeText = makeText(fonts, { text: r.likes, role: "body", weight: 600, size: footerTextSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    likeText.alpha = 0.82;
    likeText.position.set(textLeft + footerIconSize + 10 * k, footerY);
    c.addChild(likeText);

    const Ti = 0.35 + i * 0.2;

    // The top comment's like count ticks up live, with a small confirmation bounce.
    if (i === 0) {
      const parsed = parseCompactNumber(r.likes);
      if (parsed > 0) {
        const startVal = Math.max(0, Math.round(parsed * 0.965));
        likeText.text = formatCompactNumber(startVal);
        tick.node = likeText;
        tick.target = parsed;
        tick.startVal = startVal;
        tick.winStart = Ti + 0.75;
        tick.winEnd = tick.winStart + 0.9;
        const tickWinEnd = tick.winEnd;
        timeline
          .to(likeText, { prop: "scale.x", from: 1, to: 1.14, start: tickWinEnd, duration: 0.14, ease: outQuad })
          .to(likeText, { prop: "scale.y", from: 1, to: 1.14, start: tickWinEnd, duration: 0.14, ease: outQuad })
          .to(likeText, { prop: "scale.x", from: 1.14, to: 1, start: tickWinEnd + 0.14, duration: 0.26, ease: outQuad })
          .to(likeText, { prop: "scale.y", from: 1.14, to: 1, start: tickWinEnd + 0.14, duration: 0.26, ease: outQuad });
      }
    }

    const replyGap = 24 * k;
    const replyX = textLeft + footerIconSize + 10 * k + likeText.width + replyGap;
    const glyph = replyGlyph(20 * k, textColor);
    glyph.alpha = 0.55;
    glyph.position.set(replyX, footerY);
    c.addChild(glyph);
    const replyLabel = makeText(fonts, { text: "Reply", role: "body", weight: 600, size: footerTextSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    replyLabel.alpha = 0.55;
    replyLabel.position.set(replyX + 18 * k, footerY);
    c.addChild(replyLabel);

    c.position.set(cardX, restTop + riseAmt);
    c.alpha = 0;
    root.addChild(c);

    timeline
      .to(c, { prop: "alpha", from: 0, to: 1, start: Ti, duration: 0.35, ease: outQuad })
      .to(c, { prop: "y", from: restTop + riseAmt, to: restTop, start: Ti, duration: 0.62, ease: spring(0.5) })
      .to(heart, { prop: "scale.x", from: 0, to: 1, start: Ti + 0.3, duration: 0.4, ease: makeOutBack(2) })
      .to(heart, { prop: "scale.y", from: 0, to: 1, start: Ti + 0.3, duration: 0.4, ease: makeOutBack(2) });
  });

  // --- "NEW" badge stamps in at the top-left of the comment stack ---
  if (showNew) {
    const pillH = 42 * k;
    const pillPadX = 18 * k;
    const pillFontSize = Math.round(22 * k);
    const pillText = "NEW";
    const familyDisplay = fonts.family("display");
    const pillTextW = fonts.measure(pillText, { family: familyDisplay, weight: 700, size: pillFontSize });
    const pillW = pillTextW + pillPadX * 2;
    const pill = new Container();
    pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent));
    pill.addChild(makeText(fonts, { text: pillText, role: "display", weight: 700, size: pillFontSize, color: onAccent, anchor: 0.5, letterSpacing: 1.5 }));
    const pillCX = cardX + pillW / 2 + 4 * k;
    const pillCY = stackTop - pillH / 2 - 14 * k;
    pill.position.set(pillCX, pillCY);
    pill.rotation = -18 * DEG;
    pill.scale.set(0);
    root.addChild(pill);
    timeline
      .to(pill, { prop: "scale.x", from: 0, to: 1, start: 0.05, duration: 0.55, ease: makeOutBack(2.2) })
      .to(pill, { prop: "scale.y", from: 0, to: 1, start: 0.05, duration: 0.55, ease: makeOutBack(2.2) })
      .to(pill, { prop: "rotation", from: -18 * DEG, to: -7 * DEG, start: 0.05, duration: 0.55, ease: outQuint });
  }

  const capturedTick = tick.node;
  const update = capturedTick
    ? (t: number): void => {
        const u = t <= tick.winStart ? 0 : t >= tick.winEnd ? 1 : (t - tick.winStart) / (tick.winEnd - tick.winStart);
        const val = tick.startVal + (tick.target - tick.startVal) * outCubic(u);
        capturedTick.text = formatCompactNumber(Math.round(val));
      }
    : undefined;

  return update ? { timeline, duration: 5.0, update } : { timeline, duration: 5.0 };
}

export const commentThread: TemplateDefinition = {
  id: "comment-thread",
  name: "Comment Thread",
  tagline: "A comment section springs in, complete with likes and a NEW badge.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.8,
  palettes: PALETTES,
  fields: [
    {
      key: "comments",
      type: "textlist",
      label: "Comments (@user | text | likes)",
      default: DEFAULT_COMMENTS,
      minItems: 2,
      maxItems: 3,
      maxLength: 100,
      help: "One per line as \"@user | comment | like count\", e.g. \"@vault | so good | 2.8k\".",
    },
    { key: "showNew", type: "toggle", label: "NEW badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "card", type: "color", label: "Card", default: "", optional: true },
  ],
  build,
};
