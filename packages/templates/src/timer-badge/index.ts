import type { Text } from "pixi.js";
import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  spring,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** "5:00" / "05:00" -> total seconds; falls back to `fallback` when unparsable. */
function parseClock(raw: string, fallback: number): number {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(raw.trim());
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Total seconds -> "MM:SS", zero-padded, clamped at 00:00. */
function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = r < 10 ? `0${r}` : `${r}`;
  return `${mm}:${ss}`;
}

/** A simple analog clock face — circle + hour/minute hands — centered at (0,0). */
function clockFace(size: number, color: string): Graphics {
  const r = size * 0.42;
  const strokeW = Math.max(1.4, size * 0.09);
  return new Graphics()
    .circle(0, 0, r)
    .stroke({ color, width: strokeW })
    .moveTo(0, 0)
    .lineTo(0, -r * 0.58)
    .stroke({ color, width: strokeW, cap: "round" })
    .moveTo(0, 0)
    .lineTo(r * 0.42, r * 0.12)
    .stroke({ color, width: strokeW, cap: "round" })
    .circle(0, 0, size * 0.06)
    .fill(color);
}

type Mode = "up" | "down";

// A compact corner timer badge — a pill with a small clock icon and a MM:SS
// readout that counts up or down (derived purely from t), plus a thin ring
// that sweeps continuously around the icon. Only the full-frame `bg` rect is
// tied to the background field (defaults to the transparent sentinel so it
// composites straight onto footage); the pill uses its own palette-only
// `pillBg` so the readout stays legible once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "onyx-timer", name: "Onyx timer", colors: { pillBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "paper-timer", name: "Paper timer", colors: { pillBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6" } },
  { id: "cobalt-timer", name: "Cobalt timer", colors: { pillBg: "#0B1F4D", textColor: "#FFFFFF", accent: "#66A9FF" } },
  { id: "moss-timer", name: "Moss timer", colors: { pillBg: "#FFFFFF", textColor: "#123318", accent: "#4CAF50" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const pillBg = pc("pillBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const mode = (str(values.mode, "up") as Mode) === "down" ? "down" : "up";
  const showRing = values.showRing !== false;
  const startSeconds = parseClock(str(values.startAt, "10:00"), 600);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const pillH = Math.round(minDim * 0.058);
  const iconSize = Math.round(pillH * 0.62);
  const ringR = iconSize * 0.58;
  const padX = Math.round(pillH * 0.34);
  const gapIconText = Math.round(pillH * 0.3);
  const digitsSize = Math.round(pillH * 0.42);

  const initialReadout = fmtClock(mode === "down" ? startSeconds : 0);
  const digitsW = fonts.measure(initialReadout, { family: fonts.family("display"), weight: 700, size: digitsSize });
  const iconBlockW = iconSize + gapIconText;
  const pillW = padX * 2 + iconBlockW + digitsW;
  const pillRadius = Math.round(pillH / 2);

  const margin = Math.round(minDim * 0.028);
  const restX = zone.left + margin + pillW / 2;
  const restY = zone.top + margin + pillH / 2;

  const pill = new Container();
  pill.position.set(restX, restY);
  pill.alpha = 0;
  pill.scale.set(0.7);
  root.addChild(pill);

  const e = Math.round(pillH * 0.05);
  const off = Math.round(pillH * 0.08);
  pill.addChild(
    new Graphics()
      .roundRect(-pillW / 2 - e, -pillH / 2 - e + off, pillW + e * 2, pillH + e * 2, pillRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillRadius).fill(pillBg));

  const iconCx = -pillW / 2 + padX + iconSize / 2;
  const iconGroup = new Container();
  iconGroup.position.set(iconCx, 0);
  pill.addChild(iconGroup);
  iconGroup.addChild(clockFace(iconSize, textColor));

  let ring: Graphics | undefined;
  if (showRing) {
    ring = new Graphics();
    iconGroup.addChildAt(ring, 0); // behind the clock face
  }

  const digitsX = -pillW / 2 + padX + iconBlockW;
  const digitsText: Text = makeText(fonts, {
    text: initialReadout,
    role: "display",
    weight: 700,
    size: digitsSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  digitsText.position.set(digitsX, 0);
  pill.addChild(digitsText);

  const enterStart = 0.1;
  const enterDur = 0.5;
  timeline
    .to(pill, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.28, ease: outQuad })
    .to(pill, { prop: "scale.x", from: 0.7, to: 1, start: enterStart, duration: enterDur, ease: spring(0.48) })
    .to(pill, { prop: "scale.y", from: 0.7, to: 1, start: enterStart, duration: enterDur, ease: spring(0.48) });

  const revealAt = enterStart + enterDur;
  const SWEEP_PERIOD = 2.2;
  const ringStroke = Math.max(1.5, ringR * 0.16);
  const update = (t: number): void => {
    const elapsed = Math.max(0, t - revealAt);
    const totalSeconds = mode === "down" ? Math.max(0, startSeconds - elapsed) : elapsed;
    digitsText.text = fmtClock(totalSeconds);

    if (ring) {
      ring.clear();
      if (t >= revealAt) {
        const u = ((t - revealAt) % SWEEP_PERIOD) / SWEEP_PERIOD;
        const angle = -Math.PI / 2 + u * Math.PI * 2;
        ring.arc(0, 0, ringR, -Math.PI / 2, angle).stroke({ color: accent, width: ringStroke, cap: "round" });
      }
    }
  };

  return { timeline, duration: 4.2, update };
}

export const timerBadge: TemplateDefinition = {
  id: "timer-badge",
  name: "Timer Badge",
  tagline: "A corner timer pill counts up or down with a sweeping ring.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { startAt: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "mode",
      type: "select",
      label: "Count direction",
      default: "up",
      options: [
        { value: "up", label: "Count up" },
        { value: "down", label: "Count down" },
      ],
    },
    { key: "startAt", type: "text", label: "Starting time (M:SS)", default: "10:00", maxLength: 6, help: "Used as the countdown target when counting down." },
    { key: "showRing", type: "toggle", label: "Sweeping ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
