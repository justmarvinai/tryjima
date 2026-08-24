import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  linear,
  outQuad,
  outCubic,
  makeOutBack,
  spring,
  outExpo,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { avatar } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

function formatClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// bubbleBg / labelColor / onAccent / waveBase are palette-only roles so the
// bubble surface, timer and unplayed waveform stay legible under recolors.
const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#F4F5F7", bubbleBg: "#FFFFFF", textColor: "#14161C", labelColor: "#5A6070", accent: "#0A62D0", onAccent: "#FFFFFF", waveBase: "#C3C8D2" } },
  { id: "latte", name: "Latte", colors: { background: "#FBF3E9", bubbleBg: "#FFFFFF", textColor: "#2A1B0C", labelColor: "#6E5C4B", accent: "#C2380F", onAccent: "#FFFFFF", waveBase: "#DCCDBB" } },
  { id: "matcha", name: "Matcha", colors: { background: "#E9F7F0", bubbleBg: "#FFFFFF", textColor: "#08221A", labelColor: "#47665A", accent: "#0F7A3D", onAccent: "#FFFFFF", waveBase: "#C2DCCE" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0D12", bubbleBg: "#1D1F29", textColor: "#F4F5F9", labelColor: "#A2A8B8", accent: "#9BB8FF", onAccent: "#0E1430", waveBase: "#3C4152" } },
];

const N_BARS = 24;
const PLAY_TAP = 0.85;
const PLAY_START = 1.0;
const PLAY_DUR = 1.55;
const PLAY_END = PLAY_START + PLAY_DUR;
const REPLY_AT = 2.8;
const DURATION = 4.1;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F5F7"));
  const bubbleBg = str(values.bubbleColor, pc("bubbleBg", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#14161C"));
  const labelColor = pc("labelColor", "#5A6070");
  const accent = str(values.accent, pc("accent", "#0A62D0"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const waveBase = pc("waveBase", "#C3C8D2");

  const name = str(values.name, "Maya");
  const noteLen = Math.max(1, Math.round(num(values.noteLen, 7)));
  const reply = str(values.reply, "Hahaha love this 😂");
  const showAvatar = on(values.showAvatar);
  const showReply = on(values.showReply);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // Waveform bar heights — seeded, smoothed, tapered at the ends.
  const raws: number[] = [];
  for (let j = 0; j < N_BARS; j++) raws.push(rng.range(0.25, 1));
  const phases: number[] = [];
  for (let j = 0; j < N_BARS; j++) phases.push(rng.range(0, Math.PI * 2));

  // --- Vertical stack: name, voice bubble, (reply) — centered in safe ---
  const ns = Math.round(minDim * 0.026);
  const nameH = ns * 1.3;
  const gapN = minDim * 0.014;
  const bh = minDim * 0.155;
  const gapR = minDim * 0.04;
  const rs0 = Math.round(minDim * 0.036);
  const rPadX = minDim * 0.032;
  const rh = minDim * 0.098;
  const totalH = nameH + gapN + bh + (showReply ? gapR + rh : 0);
  const top = safe.y + (safe.height - totalH) / 2;

  // Chat column: full safe width on portrait aspects, capped + centered on 16:9
  // so the left/right bubbles still read as one conversation.
  const colW = Math.min(safe.width, minDim * 1.1);
  const colX0 = Math.max(safe.x, w / 2 - colW / 2);
  const colX1 = Math.min(safe.x + safe.width, w / 2 + colW / 2);

  const avatarR = minDim * 0.046;
  const bx0 = colX0 + (showAvatar ? avatarR * 2 + minDim * 0.02 : 0);
  const bw = Math.min(colX1 - bx0, minDim * 0.84);
  const bubbleTop = top + nameH + gapN;
  const bubCx = bx0 + bw / 2;
  const bubCy = bubbleTop + bh / 2;

  // --- Sender name ---
  const nameText = makeText(fonts, { text: name, role: "body", weight: 600, size: fitSize(fonts, name, "body", 600, ns, bw * 0.7), color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(bx0 + minDim * 0.02, top + nameH / 2);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline.to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad });

  // --- Avatar ---
  if (showAvatar) {
    const av = avatar(fonts, { radius: avatarR, bg: accent, initial: name.slice(0, 1).toUpperCase(), textColor: onAccent, ring: { color: bubbleBg, width: Math.max(2, avatarR * 0.1) } });
    av.position.set(colX0 + avatarR, bubbleTop + bh - avatarR);
    av.scale.set(0);
    root.addChild(av);
    timeline
      .to(av, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.5, ease: makeOutBack(1.8) })
      .to(av, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.5, ease: makeOutBack(1.8) });
  }

  // --- Voice bubble ---
  const bub = new Container();
  bub.position.set(bubCx, bubCy + minDim * 0.03);
  bub.alpha = 0;
  bub.scale.set(0.7);
  root.addChild(bub);

  const radius = bh * 0.42;
  const bubShadow = new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, radius).fill({ color: 0x000000, alpha: 0.1 });
  bubShadow.position.set(0, bh * 0.05);
  bub.addChild(bubShadow);
  // Tail toward the sender's avatar.
  bub.addChild(new Graphics().circle(-bw / 2 + bh * 0.12, bh / 2 - bh * 0.1, bh * 0.13).fill(bubbleBg));
  bub.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, radius).fill(bubbleBg));

  timeline
    .to(bub, { prop: "alpha", from: 0, to: 1, start: 0.22, duration: 0.28, ease: outQuad })
    .to(bub, { prop: "scale.x", from: 0.7, to: 1, start: 0.22, duration: 0.55, ease: spring(0.48) })
    .to(bub, { prop: "scale.y", from: 0.7, to: 1, start: 0.22, duration: 0.55, ease: spring(0.48) })
    .to(bub, { prop: "y", from: bubCy + minDim * 0.03, to: bubCy, start: 0.22, duration: 0.55, ease: outExpo });

  // --- Play button (play <-> pause crossfade) ---
  const pad = bh * 0.22;
  const pr = bh * 0.3;
  const btn = new Container();
  btn.position.set(-bw / 2 + pad + pr, 0);
  btn.addChild(new Graphics().circle(0, 0, pr).fill(accent));
  const playIcon = makeIcon("play", pr * 1.05, { color: onAccent });
  playIcon.position.set(pr * 0.08, 0);
  btn.addChild(playIcon);
  const pauseG = new Graphics()
    .roundRect(-pr * 0.32, -pr * 0.42, pr * 0.24, pr * 0.84, pr * 0.1)
    .fill(onAccent)
    .roundRect(pr * 0.08, -pr * 0.42, pr * 0.24, pr * 0.84, pr * 0.1)
    .fill(onAccent);
  pauseG.alpha = 0;
  btn.addChild(pauseG);
  bub.addChild(btn);

  timeline
    .to(btn, { prop: "scale.x", from: 1, to: 0.85, start: PLAY_TAP, duration: 0.09, ease: outQuad })
    .to(btn, { prop: "scale.y", from: 1, to: 0.85, start: PLAY_TAP, duration: 0.09, ease: outQuad })
    .to(btn, { prop: "scale.x", from: 0.85, to: 1, start: PLAY_TAP + 0.09, duration: 0.25, ease: makeOutBack(2) })
    .to(btn, { prop: "scale.y", from: 0.85, to: 1, start: PLAY_TAP + 0.09, duration: 0.25, ease: makeOutBack(2) })
    .to(playIcon, { prop: "alpha", from: 1, to: 0, start: PLAY_TAP + 0.05, duration: 0.12, ease: outQuad })
    .to(pauseG, { prop: "alpha", from: 0, to: 1, start: PLAY_TAP + 0.05, duration: 0.12, ease: outQuad })
    .to(pauseG, { prop: "alpha", from: 1, to: 0, start: PLAY_END, duration: 0.15, ease: outQuad })
    .to(playIcon, { prop: "alpha", from: 0, to: 1, start: PLAY_END, duration: 0.15, ease: outQuad });

  // --- Timer (counts up in update) ---
  const timerSize = Math.round(bh * 0.2);
  const timerReserve = fonts.measure(formatClock(noteLen), { family: fonts.family("body"), weight: 600, size: timerSize });
  const timerText = makeText(fonts, { text: "0:00", role: "body", weight: 600, size: timerSize, color: labelColor, anchor: { x: 1, y: 0.5 } });
  timerText.position.set(bw / 2 - pad * 0.8, 0);
  bub.addChild(timerText);

  // --- Waveform: base bars + accent bars filled by a traveling mask ---
  const waveX0 = -bw / 2 + pad + pr * 2 + bh * 0.16;
  const waveX1 = bw / 2 - pad * 0.8 - timerReserve - bh * 0.14;
  const span = Math.max(bh, waveX1 - waveX0);
  const slotW = span / N_BARS;
  const barW = slotW * 0.55;
  const maxBarH = bh * 0.5;
  const minBarH = bh * 0.1;

  const heights: number[] = [];
  for (let j = 0; j < N_BARS; j++) {
    const l = raws[Math.max(0, j - 1)]!;
    const r = raws[Math.min(N_BARS - 1, j + 1)]!;
    const smooth = 0.6 * raws[j]! + 0.2 * l + 0.2 * r;
    const env = Math.pow(Math.sin((Math.PI * (j + 0.5)) / N_BARS), 0.7);
    heights.push(minBarH + (maxBarH - minBarH) * clamp01(0.15 + 0.85 * smooth * env));
  }

  const baseBars: Graphics[] = [];
  const accBars: Graphics[] = [];
  const baseLayer = new Container();
  const accLayer = new Container();
  bub.addChild(baseLayer);
  bub.addChild(accLayer);
  for (let j = 0; j < N_BARS; j++) {
    const bx = waveX0 + slotW * (j + 0.5);
    const bhj = heights[j]!;
    const mk = (color: string): Graphics => {
      const g = new Graphics().roundRect(-barW / 2, -bhj / 2, barW, bhj, barW / 2).fill(color);
      g.position.set(bx, 0);
      return g;
    };
    const base = mk(waveBase);
    const acc = mk(accent);
    baseLayer.addChild(base);
    accLayer.addChild(acc);
    baseBars.push(base);
    accBars.push(acc);
  }

  const maskRect = new Graphics().rect(0, -bh / 2, span + slotW, bh).fill(0xffffff);
  maskRect.position.set(waveX0, 0);
  maskRect.scale.set(0, 1);
  bub.addChild(maskRect);
  accLayer.mask = maskRect;
  timeline.to(maskRect, { prop: "scale.x", from: 0, to: 1, start: PLAY_START, duration: PLAY_DUR, ease: linear });

  // --- Progress dot rides the fill edge ---
  const dot = new Container();
  dot.addChild(new Graphics().circle(0, 0, bh * 0.075).fill(bubbleBg));
  dot.addChild(new Graphics().circle(0, 0, bh * 0.052).fill(accent));
  dot.position.set(waveX0 + slotW * 0.5, 0);
  dot.alpha = 0;
  bub.addChild(dot);
  timeline
    .to(dot, { prop: "alpha", from: 0, to: 1, start: PLAY_START - 0.08, duration: 0.2, ease: outQuad })
    .to(dot, { prop: "x", from: waveX0 + slotW * 0.5, to: waveX0 + span, start: PLAY_START, duration: PLAY_DUR, ease: linear });

  // --- Reply bubble pops after the note finishes ---
  if (showReply) {
    const rSize = fitSize(fonts, reply, "body", 500, rs0, bw * 0.86 - rPadX * 2);
    const rText = makeText(fonts, { text: reply, role: "body", weight: 500, size: rSize, color: onAccent, anchor: 0.5 });
    const rW = rText.width + rPadX * 2;
    const rCx = colX1 - rW / 2;
    const rCy = bubbleTop + bh + gapR + rh / 2;
    const rBub = new Container();
    const rShadow = new Graphics().roundRect(-rW / 2, -rh / 2, rW, rh, rh * 0.42).fill({ color: 0x000000, alpha: 0.1 });
    rShadow.position.set(0, rh * 0.06);
    rBub.addChild(rShadow);
    rBub.addChild(new Graphics().circle(rW / 2 - rh * 0.12, rh / 2 - rh * 0.1, rh * 0.13).fill(accent));
    rBub.addChild(new Graphics().roundRect(-rW / 2, -rh / 2, rW, rh, rh * 0.42).fill(accent));
    rBub.addChild(rText);
    rBub.position.set(rCx, rCy + minDim * 0.03);
    rBub.alpha = 0;
    rBub.scale.set(0.6);
    root.addChild(rBub);
    timeline
      .to(rBub, { prop: "alpha", from: 0, to: 1, start: REPLY_AT, duration: 0.25, ease: outQuad })
      .to(rBub, { prop: "scale.x", from: 0.6, to: 1, start: REPLY_AT, duration: 0.55, ease: spring(0.45) })
      .to(rBub, { prop: "scale.y", from: 0.6, to: 1, start: REPLY_AT, duration: 0.55, ease: spring(0.45) })
      .to(rBub, { prop: "y", from: rCy + minDim * 0.03, to: rCy, start: REPLY_AT, duration: 0.55, ease: outCubic });
  }

  // --- Pure per-frame hook: timer count + bars dancing near the playhead ---
  const update = (t: number): void => {
    const u = clamp01((t - PLAY_START) / PLAY_DUR);
    const secs = u >= 1 ? noteLen : Math.min(noteLen, Math.floor(u * noteLen + 1e-6));
    timerText.text = formatClock(secs);

    const env = clamp01((t - PLAY_START) / 0.25) * clamp01((PLAY_END - t) / 0.25);
    const head = u * (N_BARS - 1);
    for (let j = 0; j < N_BARS; j++) {
      const d = (j - head) / 2.5;
      const prox = Math.exp(-d * d);
      const sway = env * prox * (0.35 + 0.3 * Math.sin(t * 16 + phases[j]!));
      const sy = 1 + sway;
      baseBars[j]!.scale.y = sy;
      accBars[j]!.scale.y = sy;
    }
  };

  return { timeline, duration: DURATION, update };
}

export const voiceNote: TemplateDefinition = {
  id: "voice-note",
  name: "Voice Note",
  tagline: "A voice message plays out — the waveform fills, the timer runs, a reply pops in.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { name: "body", reply: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Sender name", default: "Maya", maxLength: 20, shrinkToFit: true },
    { key: "noteLen", type: "slider", label: "Note length (seconds)", default: 7, min: 3, max: 30, step: 1 },
    { key: "reply", type: "text", label: "Reply", default: "Hahaha love this 😂", maxLength: 40, shrinkToFit: true },
    { key: "showAvatar", type: "toggle", label: "Sender avatar", default: true },
    { key: "showReply", type: "toggle", label: "Reply bubble", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "bubbleColor", type: "color", label: "Bubble", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};
