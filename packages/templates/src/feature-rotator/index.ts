import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outCubic,
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

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

const DEFAULT_FEATURES = ["Fast exports", "No watermark", "Free forever", "Works offline"];
const ICON_CYCLE: IconName[] = ["bolt", "heart", "star", "check", "bell", "cart"];

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", accent: "#FF4D1C", textColor: "#2A0F06", muted: "#D8C7BE" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", muted: "#D3C9F2" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", muted: "#C2D4EA" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", accent: "#84CC16", textColor: "#FFFFFF", muted: "#3A3D44" } },
];

// Rotation schedule: hold on feature 0, then (n-1) turn+hold cycles, ending on
// a held final feature (a designed hold frame, no mid-motion cutoff).
const HOLD_FIRST = 0.9;
const TURN = 0.5;
const HOLD = 0.85;
const END_EXTRA = 0.3;

function schedule(n: number): { starts: number[]; totalDur: number } {
  const starts: number[] = [];
  let t = HOLD_FIRST;
  for (let i = 0; i < n - 1; i++) {
    starts.push(t);
    t += TURN + HOLD;
  }
  return { starts, totalDur: t + END_EXTRA };
}

function featureList(values: Values): string[] {
  const raw = values.features;
  if (Array.isArray(raw)) {
    const arr = raw.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length >= 4) return arr.slice(0, 6);
  }
  return DEFAULT_FEATURES;
}

function computeDuration(values: Values): number {
  return schedule(featureList(values).length).totalDur;
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

interface FeatureNode {
  baseAngle: number;
  dot: Graphics;
  label: Text;
  icon: Graphics;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#2A0F06"));
  const muted = pc("muted", "#D8C7BE");
  const title = str(values.title, "");
  const showDial = values.showDial !== false;
  const features = featureList(values);
  const n = features.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const cx = w / 2;
  const cy = h * 0.56;
  const R = minDim * 0.27;
  const labelGap = R * 0.2;
  const iconGap = R * 0.22;
  const iconSize = R * 0.42;
  const labelSize = Math.round(R * 0.2);
  const dotR = Math.max(4, R * 0.045);
  const labelMaxW = R * 1.5;
  const angleStep = (2 * Math.PI) / n;

  // Scale/fade the whole dial in about its own visual center (pivot === position).
  const dialGroup = new Container();
  dialGroup.position.set(cx, cy);
  dialGroup.pivot.set(cx, cy);
  dialGroup.alpha = 0;
  dialGroup.scale.set(0.85);
  root.addChild(dialGroup);
  timeline
    .to(dialGroup, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.5, ease: outQuad })
    .to(dialGroup, { prop: "scale.x", from: 0.85, to: 1, start: 0, duration: 0.6, ease: makeOutBack(1.3) })
    .to(dialGroup, { prop: "scale.y", from: 0.85, to: 1, start: 0, duration: 0.6, ease: makeOutBack(1.3) });

  if (showDial) {
    dialGroup.addChild(new Graphics().circle(cx, cy, R).stroke({ color: muted, width: Math.max(2, R * 0.012), alpha: 0.8 }));
  }

  const nodes: FeatureNode[] = features.map((f, i) => {
    const baseAngle = -Math.PI / 2 + i * angleStep;
    const dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dialGroup.addChild(dot);
    const label = fitText(
      fonts,
      { text: f, role: "display", weight: 700, size: labelSize, color: textColor, anchor: 0.5, align: "center" },
      labelMaxW,
    );
    dialGroup.addChild(label);
    const icon = makeIcon(ICON_CYCLE[i % ICON_CYCLE.length]!, iconSize, { color: accent });
    icon.alpha = 0;
    dialGroup.addChild(icon);
    return { baseAngle, dot, label, icon };
  });

  // Wheel rotation lives on a plain state object — the timeline drives it via
  // sequential holds/turns; update() reads it back to place every feature.
  const wheelState = { rotation: 0 };
  const { starts } = schedule(n);
  starts.forEach((startT, i) => {
    const from = -i * angleStep;
    const to = -(i + 1) * angleStep;
    timeline.to(wheelState, { prop: "rotation", from, to, start: startT, duration: TURN, ease: outCubic });
  });

  const TOP = -Math.PI / 2;
  const falloff = angleStep * 0.85;
  const update = (): void => {
    const rot = wheelState.rotation;
    for (const node of nodes) {
      const worldAngle = node.baseAngle + rot;
      const d = Math.atan2(Math.sin(worldAngle - TOP), Math.cos(worldAngle - TOP));
      const emphasis = clamp01(1 - Math.abs(d) / falloff);

      const dotX = cx + R * Math.cos(worldAngle);
      const dotY = cy + R * Math.sin(worldAngle);
      node.dot.position.set(dotX, dotY);

      const rl = R + labelGap;
      node.label.position.set(cx + rl * Math.cos(worldAngle), cy + rl * Math.sin(worldAngle));
      const labelScale = lerp(0.5, 1, emphasis);
      node.label.scale.set(labelScale);

      const ri = R + labelGap + iconGap;
      node.icon.position.set(cx + ri * Math.cos(worldAngle), cy + ri * Math.sin(worldAngle));
      node.icon.alpha = emphasis;
      const iconScale = lerp(0.7, 1, emphasis);
      node.icon.scale.set(iconScale);
    }
  };

  if (title.length > 0) {
    const titleSize = Math.round(w * 0.045);
    const titleY = h * 0.07;
    const titleText = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.8,
    );
    titleText.position.set(cx, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.45, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0.15, duration: 0.5, ease: outQuint });
  }

  return { timeline, duration: computeDuration(values), update };
}

export const featureRotator: TemplateDefinition = {
  id: "feature-rotator",
  name: "Feature Rotator",
  tagline: "A circular dial swings each feature up to the spotlight.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.2,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", features: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "", maxLength: 30, optional: true, shrinkToFit: true },
    { key: "features", type: "textlist", label: "Features", default: DEFAULT_FEATURES, minItems: 4, maxItems: 6, maxLength: 20 },
    { key: "showDial", type: "toggle", label: "Dial ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
