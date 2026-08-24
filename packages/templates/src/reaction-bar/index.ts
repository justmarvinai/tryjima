import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outCubic,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

interface Stat {
  value: number;
  decimals: number;
  suffix: string;
}

/** Parse a compact stat like "24.8K", "1,204", "97" into an animatable value. */
function parseStat(raw: string): Stat {
  const m = /^\s*(\d[\d,]*)(\.(\d+))?\s*([a-zA-Z%]*)\s*$/.exec(raw);
  if (!m) return { value: 0, decimals: 0, suffix: "" };
  const intPart = m[1]!.replace(/,/g, "");
  const decPart = m[3] ?? "";
  const suffix = m[4] ?? "";
  const value = Number(intPart + (decPart ? "." + decPart : ""));
  return { value: Number.isFinite(value) ? value : 0, decimals: decPart.length, suffix };
}

/** Format a mid-count value, preserving the stat's decimal precision + suffix. */
function formatStat(s: Stat, frac: number): string {
  const v = s.value * frac;
  if (s.decimals > 0) return v.toFixed(s.decimals) + s.suffix;
  return groupThousands(Math.round(v)) + s.suffix;
}

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF3B5C", muted: "#F1F1F4", onAccent: "#FFFFFF" } },
  { id: "dark", name: "Dark", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF6A3D", muted: "#26262C", onAccent: "#FFFFFF" } },
  { id: "bubblegum", name: "Bubblegum", colors: { background: "#FFF0F6", textColor: "#3A0A28", accent: "#FF2E9E", muted: "#FBD9EA", onAccent: "#FFFFFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EAF6FF", textColor: "#062338", accent: "#0B84FF", muted: "#D3ECFF", onAccent: "#FFFFFF" } },
];

interface ReactionSpec {
  icon: IconName;
  key: string;
  label: string;
  defaultVal: string;
}

const SPECS: ReactionSpec[] = [
  { icon: "heart", key: "likes", label: "Likes", defaultVal: "24.8K" },
  { icon: "comment", key: "comments", label: "Comments", defaultVal: "1,204" },
  { icon: "share", key: "shares", label: "Shares", defaultVal: "382" },
  { icon: "bookmark", key: "saves", label: "Saves", defaultVal: "97" },
];

interface ItemRefs {
  container: Container;
  countText: Text | null;
  stat: Stat;
  cx: number;
  cy: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF3B5C"));
  const muted = pc("muted", "#F1F1F4");
  const onAccent = pc("onAccent", "#FFFFFF");

  const vertical = str(values.layout, "vertical") !== "horizontal";
  const showCounts = values.showCounts !== false;
  const showBurst = values.burst !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const N = SPECS.length;

  const familyDisplay = fonts.family("display");
  const measureAt = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });

  const stats = SPECS.map((spec) => parseStat(str(values[spec.key], spec.defaultVal)));
  // The count-up only ever grows toward its target, so the target's own
  // formatted width is the widest the text will be at any point in the tween —
  // sizing against it (rather than a pessimistic placeholder) keeps typical
  // short counts nice and big while still guaranteeing no overflow.
  const finalLabels = stats.map((s) => formatStat(s, 1));

  // --- Sizing: fixed, generous disc size verified to fit 4 items in the
  // tightest safe zone (1:1 / 16:9's minDim); count text always shrinks to fit
  // its own cell, so arbitrarily long numbers never overflow. ---
  const discR = minDim * (vertical ? 0.058 : 0.05);
  const iconSize = discR * 1.15;
  const countSize0 = Math.round(discR * 0.6);
  const gapCount = discR * 0.32;
  const gapBetween = discR * (vertical ? 0.58 : 0.85);
  const cellMain = vertical ? discR * 2 + (showCounts ? gapCount + countSize0 * 1.25 : 0) : discR * 2.85;
  const countMaxWidth = vertical ? Math.min(safe.width * 0.82, minDim * 0.7) : cellMain - discR * 0.35;
  const countSize = showCounts
    ? Math.min(
        countSize0,
        ...finalLabels.map((lbl) =>
          shrinkToFit(lbl, measureAt, { maxWidth: countMaxWidth, baseSize: countSize0, minSize: Math.round(countSize0 * 0.55) }),
        ),
      )
    : countSize0;

  const total = N * cellMain + (N - 1) * gapBetween;
  const mainStart = vertical ? safe.y + (safe.height - total) / 2 : safe.x + (safe.width - total) / 2;
  const crossCenter = vertical ? safe.x + safe.width / 2 : safe.y + safe.height / 2;

  // Disc-center world position per item (the container's own origin).
  const discCenters: { x: number; y: number }[] = [];
  {
    let cursor = mainStart;
    for (let i = 0; i < N; i++) {
      const main = vertical ? cursor + discR : cursor + cellMain / 2;
      discCenters.push(vertical ? { x: crossCenter, y: main } : { x: main, y: crossCenter });
      cursor += cellMain + gapBetween;
    }
  }

  const baseStart = 0.12;
  const stagger = 0.13;
  const popDur = 0.55;
  const itemStart = (i: number): number => baseStart + i * stagger;
  const countStart = (i: number): number => itemStart(i) + 0.25;
  const countDur = 0.65;

  const items: ItemRefs[] = [];

  SPECS.forEach((spec, i) => {
    const isHeart = i === 0;
    const discColor = isHeart ? accent : muted;
    const iconColor = isHeart ? onAccent : textColor;

    const c = new Container();
    c.position.set(discCenters[i]!.x, discCenters[i]!.y);

    const disc = new Graphics().circle(0, 0, discR).fill(discColor);
    c.addChild(disc);
    const icon = makeIcon(spec.icon, iconSize, { color: iconColor, holeColor: discColor });
    c.addChild(icon);

    let countText: Text | null = null;
    if (showCounts) {
      countText = makeText(fonts, { text: formatStat(stats[i]!, 0), role: "display", weight: 700, size: countSize, color: textColor, anchor: 0.5 });
      countText.position.set(0, discR + gapCount + countSize * 0.5);
      c.addChild(countText);
    }

    c.alpha = 0;
    c.scale.set(0);
    root.addChild(c);
    items.push({ container: c, countText, stat: stats[i]!, cx: discCenters[i]!.x, cy: discCenters[i]!.y });

    const start = itemStart(i);
    timeline
      .to(c, { prop: "alpha", from: 0, to: 1, start, duration: popDur * 0.5, ease: outQuad })
      .to(c, { prop: "scale.x", from: 0, to: 1, start, duration: popDur, ease: makeOutBack(1.7) })
      .to(c, { prop: "scale.y", from: 0, to: 1, start, duration: popDur, ease: makeOutBack(1.7) });
  });

  // --- Heart burst: a little particle pop + a secondary beat once it lands ---
  const heart = items[0]!;
  const BURST = itemStart(0) + popDur;
  const PULSE_START = BURST + 0.08;
  const BURST_LIFE = 0.75;
  const burstDots: { g: Graphics; ang: number; speed: number }[] = [];
  if (showBurst) {
    const BN = 10;
    for (let i = 0; i < BN; i++) {
      const s = discR * rng.range(0.14, 0.26);
      const g = new Graphics().circle(0, 0, s).fill(rng.pick([accent, textColor]));
      g.position.set(heart.cx, heart.cy);
      g.visible = false;
      root.addChild(g);
      const ang = (i / BN) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const speed = discR * rng.range(2.2, 3.6);
      burstDots.push({ g, ang, speed });
    }
    timeline
      .to(heart.container, { prop: "scale.x", from: 1, to: 1.18, start: PULSE_START, duration: 0.14, ease: outQuad })
      .to(heart.container, { prop: "scale.y", from: 1, to: 1.18, start: PULSE_START, duration: 0.14, ease: outQuad })
      .to(heart.container, { prop: "scale.x", from: 1.18, to: 1, start: PULSE_START + 0.14, duration: 0.26, ease: outQuad })
      .to(heart.container, { prop: "scale.y", from: 1.18, to: 1, start: PULSE_START + 0.14, duration: 0.26, ease: outQuad });
  }

  const update = (t: number): void => {
    if (showCounts) {
      items.forEach((it, i) => {
        if (!it.countText) return;
        const cs = countStart(i);
        const ce = cs + countDur;
        const u = t <= cs ? 0 : t >= ce ? 1 : (t - cs) / (ce - cs);
        it.countText.text = formatStat(it.stat, outCubic(u));
      });
    }
    if (showBurst) {
      for (const b of burstDots) {
        const tau = t - BURST;
        if (tau < 0 || tau > BURST_LIFE) {
          b.g.visible = false;
          continue;
        }
        const p = clamp01(tau / BURST_LIFE);
        const grow = outCubic(p);
        b.g.visible = true;
        b.g.x = heart.cx + Math.cos(b.ang) * b.speed * grow;
        b.g.y = heart.cy + Math.sin(b.ang) * b.speed * grow;
        b.g.alpha = 1 - p;
      }
    }
  };

  return { timeline, duration: 2.3, update };
}

export const reactionBar: TemplateDefinition = {
  id: "reaction-bar",
  name: "Reaction Bar",
  tagline: "A floating action bar pops in — the heart bursts and counts tick up.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 1.7,
  fontRoles: { likes: "display", comments: "display", shares: "display", saves: "display" },
  palettes: PALETTES,
  fields: [
    { key: "likes", type: "text", label: "Likes", default: "24.8K", maxLength: 10, help: "Counts up. Use K/M for compact (24.8K)." },
    { key: "comments", type: "text", label: "Comments", default: "1,204", maxLength: 10, help: "Counts up." },
    { key: "shares", type: "text", label: "Shares", default: "382", maxLength: 10, help: "Counts up." },
    { key: "saves", type: "text", label: "Saves", default: "97", maxLength: 10, help: "Counts up." },
    {
      key: "layout",
      type: "select",
      label: "Layout",
      default: "vertical",
      options: [
        { value: "vertical", label: "Vertical" },
        { value: "horizontal", label: "Horizontal" },
      ],
    },
    { key: "showCounts", type: "toggle", label: "Show counts", default: true },
    { key: "burst", type: "toggle", label: "Heart burst", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
