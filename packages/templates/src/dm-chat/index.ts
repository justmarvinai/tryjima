import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  inQuad,
  spring,
  safeRect,
  fitBox,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makePill } from "../shared/ui";

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

const DEFAULT_MESSAGES = ["Did you see the new drop?", "Just posted it \u{1F525}", "Link in bio!"];
const PER = 0.85;
const TYPING_HOLD = 1.0;
const START0 = 0.3;

const PALETTES: Palette[] = [
  { id: "daylight", name: "Daylight", colors: { background: "#F2F3F5", incoming: "#E9E9EC", accent: "#0B84FF", textColor: "#101014" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B0F", incoming: "#1F1F26", accent: "#FF4D1C", textColor: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7F0", incoming: "#FFFFFF", accent: "#17A34A", textColor: "#08221A" } },
  { id: "bubblegum", name: "Bubblegum", colors: { background: "#FFEEF6", incoming: "#FFFFFF", accent: "#FF2E9E", textColor: "#3A0A28" } },
];

function messagesOf(values: Values): string[] {
  return asItems(values.messages, DEFAULT_MESSAGES).slice(0, 4);
}

function computeDuration(values: Values): number {
  const n = messagesOf(values).length;
  const showTyping = values.showTyping !== false;
  const lastStart = START0 + Math.max(0, n - 1) * PER + (showTyping ? TYPING_HOLD : 0);
  return lastStart + 0.6 + 1.0;
}

interface Row {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  w: number;
  h: number;
  side: "left" | "right";
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F2F3F5"));
  const incoming = str(values.incoming, pc("incoming", "#E9E9EC"));
  const accent = str(values.accent, pc("accent", "#0B84FF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const showTyping = values.showTyping !== false;
  const messages = messagesOf(values);
  const n = messages.length;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const k = minDim / 1080;
  const safe = safeRect(ctx.aspect);

  const padX = 30 * k;
  const padY = 22 * k;
  const msgSize0 = Math.round(38 * k);
  const gap = 20 * k;
  const maxBubbleW = Math.min(safe.width * 0.72, minDim * 0.72);
  const maxTextW = maxBubbleW - padX * 2;
  const radius = 26 * k;

  const familyBody = fonts.family("body");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 500, size: sz });

  const rows: Row[] = messages.map((msg, i) => {
    const { fontSize, lines } = fitBox(msg, measure, {
      maxWidth: maxTextW,
      baseSize: msgSize0,
      minSize: Math.round(msgSize0 * 0.62),
      maxLines: 4,
    });
    const lineHeight = Math.round(fontSize * 1.3);
    const widest = Math.max(...lines.map((l) => measure(l, fontSize)));
    const w = Math.min(maxBubbleW, widest + padX * 2);
    const h = lines.length * lineHeight + padY * 2;
    return { lines, fontSize, lineHeight, w, h, side: i % 2 === 0 ? "left" : "right" };
  });

  const totalH = rows.reduce((acc, r) => acc + r.h, 0) + gap * Math.max(0, n - 1);
  const top = safe.y + (safe.height - totalH) / 2;

  const centers: number[] = [];
  let cursorY = top;
  rows.forEach((r) => {
    centers.push(cursorY + r.h / 2);
    cursorY += r.h + gap;
  });

  const riseAmt = minDim * 0.055;

  rows.forEach((r, i) => {
    const cy = centers[i]!;
    const cx = r.side === "left" ? safe.x + r.w / 2 : safe.x + safe.width - r.w / 2;
    const bubbleFill = r.side === "left" ? incoming : accent;
    const textFill = r.side === "left" ? textColor : onAccent;

    const row = new Container();
    const bubble = new Graphics().roundRect(-r.w / 2, -r.h / 2, r.w, r.h, radius).fill(bubbleFill);
    row.addChild(bubble);
    const msgText = makeText(fonts, {
      text: r.lines.join("\n"),
      role: "body",
      weight: 500,
      size: r.fontSize,
      color: textFill,
      anchor: { x: 0, y: 0 },
      lineHeight: r.lineHeight,
      align: "left",
    });
    msgText.position.set(-r.w / 2 + padX, -r.h / 2 + padY);
    row.addChild(msgText);

    row.alpha = 0;
    row.scale.set(0.6);
    row.position.set(cx, cy + riseAmt);
    root.addChild(row);

    let Ti = START0 + i * PER;
    if (i === n - 1 && showTyping) Ti += TYPING_HOLD;

    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: Ti, duration: 0.28, ease: outQuad })
      .to(row, { prop: "y", from: cy + riseAmt, to: cy, start: Ti, duration: 0.6, ease: spring(0.5) })
      .to(row, { prop: "scale.x", from: 0.6, to: 1, start: Ti, duration: 0.55, ease: makeOutBack(1.7) })
      .to(row, { prop: "scale.y", from: 0.6, to: 1, start: Ti, duration: 0.55, ease: makeOutBack(1.7) });
  });

  // --- Typing indicator (appears in the last message's slot right before it lands) ---
  if (showTyping && n > 0) {
    const lastRow = rows[n - 1]!;
    const lastCy = centers[n - 1]!;
    const dotR = 6 * k;
    const dotGap = 16 * k;
    const typW = dotGap * 2 + dotR * 2 + padX * 1.4;
    const typH = Math.max(lastRow.h * 0.56, dotR * 5);
    const typCx = lastRow.side === "left" ? safe.x + typW / 2 : safe.x + safe.width - typW / 2;
    const fill = lastRow.side === "left" ? incoming : accent;
    const dotColor = lastRow.side === "left" ? textColor : onAccent;

    const typing = new Container();
    typing.addChild(makePill(typW, typH, fill));
    const dots: Graphics[] = [];
    for (let d = 0; d < 3; d++) {
      const dot = new Graphics().circle(0, 0, dotR).fill(dotColor);
      dot.position.set((d - 1) * dotGap, 0);
      typing.addChild(dot);
      dots.push(dot);
    }
    typing.position.set(typCx, lastCy);
    typing.alpha = 0;
    typing.scale.set(0.7);
    root.addChild(typing);

    const prevEnd = n >= 2 ? START0 + (n - 2) * PER + 0.42 : 0.15;
    const typingStart = Math.max(0.1, prevEnd);
    const lastTi = START0 + (n - 1) * PER + TYPING_HOLD;
    const typingEnd = lastTi - 0.15;

    timeline
      .to(typing, { prop: "alpha", from: 0, to: 1, start: typingStart, duration: 0.25, ease: outQuad })
      .to(typing, { prop: "scale.x", from: 0.7, to: 1, start: typingStart, duration: 0.35, ease: makeOutBack(2) })
      .to(typing, { prop: "scale.y", from: 0.7, to: 1, start: typingStart, duration: 0.35, ease: makeOutBack(2) })
      .to(typing, { prop: "alpha", from: 1, to: 0, start: typingEnd, duration: 0.15, ease: outQuad })
      .to(typing, { prop: "scale.x", from: 1, to: 0.7, start: typingEnd, duration: 0.15, ease: outQuad })
      .to(typing, { prop: "scale.y", from: 1, to: 0.7, start: typingEnd, duration: 0.15, ease: outQuad });

    const bounceAmt = dotR * 1.4;
    const cyc = 0.4;
    dots.forEach((dot, di) => {
      const phase = di * 0.12;
      for (let c = 0; c < 4; c++) {
        const t0 = typingStart + 0.18 + phase + c * cyc;
        if (t0 + cyc * 0.75 > typingEnd) break;
        timeline
          .to(dot, { prop: "y", from: 0, to: -bounceAmt, start: t0, duration: cyc * 0.42, ease: outQuad })
          .to(dot, { prop: "y", from: -bounceAmt, to: 0, start: t0 + cyc * 0.42, duration: cyc * 0.42, ease: inQuad });
      }
    });
  }

  return { timeline, duration: computeDuration(values) };
}

export const dmChat: TemplateDefinition = {
  id: "dm-chat",
  name: "DM Chat",
  tagline: "A DM thread pops in bubble by bubble, with a typing beat before the reply.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.6,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "messages", type: "textlist", label: "Messages", default: DEFAULT_MESSAGES, minItems: 1, maxItems: 4, maxLength: 60 },
    { key: "showTyping", type: "toggle", label: "Typing indicator", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "incoming", type: "color", label: "Incoming bubble", default: "", optional: true },
    { key: "accent", type: "color", label: "Outgoing bubble", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};
