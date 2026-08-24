import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeRect,
  outQuad,
  outQuint,
  outCubic,
  linear,
  makeOutBack,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";
import { dashedPath, arcPoints } from "../shared/ui";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const DEFAULT_SATELLITES = ["Fast", "Secure", "Offline", "Free", "Simple"];
const ICON_CYCLE: IconName[] = ["check", "bolt", "heart", "star", "bell"];
const HERO_ICON_OPTIONS: IconName[] = ["star", "bolt", "heart", "check", "bell", "cart", "pin", "plus"];

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", textColor: "#101014", accent: "#FF4D1C", onAccent: "#FFFFFF", bubble: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", textColor: "#241452", accent: "#7C5CFF", onAccent: "#FFFFFF", bubble: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", textColor: "#0F1B2A", accent: "#2E5BD6", onAccent: "#FFFFFF", bubble: "#FFFFFF" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#84CC16", onAccent: "#101014", bubble: "#1B1D22" } },
];

function satelliteList(values: Values): string[] {
  const raw = values.satellites;
  if (Array.isArray(raw)) {
    const arr = raw.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length >= 3) return arr.slice(0, 5);
  }
  return DEFAULT_SATELLITES;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

interface Satellite {
  state: { angle: number; radius: number };
  bubble: Container;
  label: Text;
  labelRadiusOffset: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const bubbleC = pc("bubble", "#FFFFFF");
  const title = str(values.title, "");
  const heroLabel = str(values.heroLabel, "");
  const heroIconRaw = str(values.heroIcon, "star");
  const heroIconSet = new Set<string>(HERO_ICON_OPTIONS);
  const heroIcon: IconName = heroIconSet.has(heroIconRaw) ? (heroIconRaw as IconName) : "star";
  const showRing = values.showRing !== false;
  const satellites = satelliteList(values);
  const n = satellites.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const safe = safeRect(ctx.aspect);
  const titleBandH = title.length > 0 ? safe.height * 0.13 : safe.height * 0.035;
  const orbitTop = safe.y + titleBandH;
  const orbitAreaH = safe.height - titleBandH;
  const cx = safe.x + safe.width / 2;
  const cy = orbitTop + orbitAreaH * 0.5;

  const bubbleR = minDim * 0.075;
  const labelGap = minDim * 0.032;
  const labelH = minDim * 0.045;
  const labelMaxW = minDim * 0.19;
  const reachExtra = Math.max(labelH, labelMaxW / 2);
  const outerReach = bubbleR + labelGap + reachExtra;
  const maxR = Math.min(safe.width / 2, orbitAreaH / 2) - outerReach - minDim * 0.02;
  const R = Math.max(minDim * 0.16, Math.min(minDim * 0.3, maxR));
  const heroR = minDim * 0.135;

  const timeline = new JimaTimeline();

  if (title.length > 0) {
    const titleSize = Math.round(minDim * 0.05);
    const titleY = safe.y + titleBandH * 0.55;
    const t = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      safe.width * 0.86,
    );
    t.position.set(cx, titleY);
    t.alpha = 0;
    root.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.45, ease: outQuad })
      .to(t, { prop: "y", from: titleY - 14, to: titleY, start: 0.05, duration: 0.5, ease: outQuad });
  }

  // Orbit ring — a slowly-spinning dashed track. Decorative, gated by showRing.
  if (showRing) {
    const ringG = new Graphics();
    dashedPath(ringG, arcPoints(0, 0, R, 0, Math.PI * 2, 96), {
      dash: R * 0.09,
      gap: R * 0.07,
      width: Math.max(1.5, minDim * 0.004),
      color: accent,
      cap: "round",
    });
    ringG.position.set(cx, cy);
    ringG.alpha = 0;
    root.addChild(ringG);
    timeline
      .to(ringG, { prop: "alpha", from: 0, to: 0.4, start: 0.2, duration: 0.6, ease: outQuad })
      .to(ringG, { prop: "rotation", from: 0, to: 0.5, start: 0, duration: 3.4, ease: linear });
  }

  // Hero — the central item.
  const hero = new Container();
  hero.addChild(new Graphics().circle(0, 0, heroR).fill(accent));
  hero.addChild(makeIcon(heroIcon, heroR * 1.05, { color: onAccent, holeColor: accent }));
  hero.position.set(cx, cy);
  hero.alpha = 0;
  hero.scale.set(0.6);
  root.addChild(hero);
  timeline
    .to(hero, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.4, ease: outQuad })
    .to(hero, { prop: "scale.x", from: 0.6, to: 1, start: 0.05, duration: 0.65, ease: makeOutBack(1.5) })
    .to(hero, { prop: "scale.y", from: 0.6, to: 1, start: 0.05, duration: 0.65, ease: makeOutBack(1.5) });

  if (heroLabel.length > 0) {
    const hlSize = Math.round(minDim * 0.032);
    const hl = fitText(
      fonts,
      { text: heroLabel, role: "display", weight: 700, size: hlSize, color: textColor, anchor: 0.5, align: "center" },
      heroR * 2.6,
    );
    hl.position.set(cx, cy + heroR + hlSize * 0.9);
    hl.alpha = 0;
    root.addChild(hl);
    timeline.to(hl, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.4, ease: outQuad });
  }

  // Satellites — each orbits into place from a swept-back angle and a smaller
  // radius, settling evenly spaced around the ring.
  const sats: Satellite[] = [];
  const labelSize = Math.round(minDim * 0.026);
  satellites.forEach((label, i) => {
    const finalAngle = -90 + i * (360 / n);
    const startAngle = finalAngle - 62;
    const startRadius = R * 0.45;

    const bubble = new Container();
    bubble.addChild(new Graphics().circle(0, 0, bubbleR * 1.1).fill({ color: 0x000000, alpha: 0.08 }));
    bubble.addChild(new Graphics().circle(0, 0, bubbleR).fill(bubbleC));
    bubble.addChild(makeIcon(ICON_CYCLE[i % ICON_CYCLE.length]!, bubbleR * 1.05, { color: accent }));
    bubble.alpha = 0;
    bubble.scale.set(0.5);
    root.addChild(bubble);

    const labelText = fitText(
      fonts,
      { text: label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0.5, y: 0 } },
      labelMaxW,
    );
    labelText.alpha = 0;
    root.addChild(labelText);

    const state = { angle: startAngle, radius: startRadius };
    const start = 0.55 + i * 0.2;
    const dur = 0.85;
    timeline
      .to(state, { prop: "angle", from: startAngle, to: finalAngle, start, duration: dur, ease: outQuint })
      .to(state, { prop: "radius", from: startRadius, to: R, start, duration: dur, ease: outQuint })
      .to(bubble, { prop: "alpha", from: 0, to: 1, start, duration: dur * 0.55, ease: outQuad })
      .to(bubble, { prop: "scale.x", from: 0.5, to: 1, start, duration: dur, ease: outCubic })
      .to(bubble, { prop: "scale.y", from: 0.5, to: 1, start, duration: dur, ease: outCubic })
      .to(labelText, { prop: "alpha", from: 0, to: 1, start: start + dur * 0.25, duration: dur * 0.6, ease: outQuad });

    sats.push({ state, bubble, label: labelText, labelRadiusOffset: bubbleR + labelGap });
  });

  const update = (): void => {
    for (const s of sats) {
      const a = s.state.angle * DEG;
      const bx = cx + s.state.radius * Math.cos(a);
      const by = cy + s.state.radius * Math.sin(a);
      s.bubble.position.set(bx, by);
      const lr = s.state.radius + s.labelRadiusOffset;
      s.label.position.set(cx + lr * Math.cos(a), cy + lr * Math.sin(a));
    }
  };

  return { timeline, duration: 3.4, update };
}

export const orbitShowcase: TemplateDefinition = {
  id: "orbit-showcase",
  name: "Orbit Showcase",
  tagline: "Feature bubbles swing into orbit around your hero.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { title: "display", heroLabel: "display", satellites: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Everything included", maxLength: 30, optional: true, shrinkToFit: true },
    {
      key: "heroIcon",
      type: "select",
      label: "Hero icon",
      default: "star",
      options: [
        { value: "star", label: "Star" },
        { value: "bolt", label: "Bolt" },
        { value: "heart", label: "Heart" },
        { value: "check", label: "Check" },
        { value: "bell", label: "Bell" },
        { value: "cart", label: "Cart" },
        { value: "pin", label: "Pin" },
        { value: "plus", label: "Plus" },
      ],
    },
    { key: "heroLabel", type: "text", label: "Hero label", default: "Core", maxLength: 14, optional: true },
    { key: "satellites", type: "textlist", label: "Features", default: DEFAULT_SATELLITES, minItems: 3, maxItems: 5, maxLength: 12 },
    { key: "showRing", type: "toggle", label: "Orbit ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
