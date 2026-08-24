import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  inQuad,
  outQuad,
  outCubic,
  spring,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A tutorial keyboard-shortcut callout: dimensional keycaps pop in, press down
// one after another (cap sinks toward its darker side face, shadow dims), the
// chord "fires" with a flash ring, an action chip pops beside, and the keys
// release with a springy bounce. Only the full-frame `bg` rect is tied to the
// background field (defaults to the transparent sentinel so it drops straight
// onto footage); keycaps use their own palette-only `keyBg`/`keyEdge` surfaces
// (with soft shadows) and the action chip the accent, so everything survives as
// overlay content. `accentText` is a fixed, contrast-checked color for the
// label on the accent chip.
const PALETTES: Palette[] = [
  { id: "carbon", name: "Carbon", colors: { keyBg: "#26262E", keyEdge: "#101014", textColor: "#FFFFFF", accent: "#4ADE80", accentText: "#0B1F16" } },
  { id: "studio-grey", name: "Studio grey", colors: { keyBg: "#FFFFFF", keyEdge: "#C9CFDA", textColor: "#0B0B0F", accent: "#1D4ED8", accentText: "#FFFFFF" } },
  { id: "cream", name: "Cream", colors: { keyBg: "#FFF8EC", keyEdge: "#E3D5B8", textColor: "#2A1D06", accent: "#C2410C", accentText: "#FFFFFF" } },
  { id: "orchid", name: "Orchid", colors: { keyBg: "#FFFFFF", keyEdge: "#D8CCEE", textColor: "#1D1030", accent: "#7C3AED", accentText: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const keyBg = pc("keyBg", "#26262E");
  const keyEdge = pc("keyEdge", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#4ADE80"));
  const accentText = pc("accentText", "#0B1F16");

  const keys = asList(values.keys, ["Ctrl", "S"]).slice(0, 3);
  const label = str(values.label, "Save");
  const showPlus = values.showPlus !== false;
  const showFlash = values.showFlash !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry (keycap row + action chip, centered as one group). ---
  const capH = Math.round(minDim * 0.088);
  const depth = Math.max(4, Math.round(capH * 0.11));
  const capR = Math.round(capH * 0.22);
  const keyTextSize0 = Math.round(capH * 0.34);

  const keySizes = keys.map((k) => fitSize(fonts, k, "body", 700, keyTextSize0, minDim * 0.2));
  const capWs = keys.map((k, i) => {
    const tw = fonts.measure(k, { family: fonts.family("body"), weight: 700, size: keySizes[i]! });
    return Math.min(Math.round(minDim * 0.24), Math.max(capH, Math.round(tw + capH * 0.5)));
  });

  const plusSize = Math.round(capH * 0.36);
  const plusW = showPlus ? fonts.measure("+", { family: fonts.family("body"), weight: 700, size: plusSize }) : 0;
  const gapK = Math.round(capH * 0.3);
  const labelGap = Math.round(capH * 0.5);

  const labelSize = fitSize(fonts, label, "display", 700, Math.round(capH * 0.32), minDim * 0.3);
  const labelW = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: labelSize });
  const lPadX = Math.round(capH * 0.3);
  const chipH = Math.round(capH * 0.62);
  const chipW = Math.round(labelW + lPadX * 2);

  const rowW = capWs.reduce((a, b) => a + b, 0) + (keys.length - 1) * (gapK * 2 + plusW);
  const totalW = rowW + labelGap + chipW;
  const safeW = w - zone.left - zone.right;
  const groupScale = Math.min(1, (safeW * 0.96) / totalW);

  const group = new Container();
  group.position.set(w / 2, h - zone.bottom - Math.round(minDim * 0.035) - ((capH + depth) / 2) * groupScale);
  group.scale.set(groupScale);
  root.addChild(group);

  const pressY = Math.round(depth * 0.75);
  const P0 = 1.1;
  const PRESS_GAP = 0.38;
  const lastDown = P0 + (keys.length - 1) * PRESS_GAP + 0.11;
  const tc = lastDown + 0.04; // the chord "fires"
  const R = tc + 0.75; // release

  // --- Flash ring behind the last key (added first so it sits underneath). ---
  let cursor = -totalW / 2;
  const keyCenters: number[] = [];
  for (let i = 0; i < keys.length; i++) {
    keyCenters.push(cursor + capWs[i]! / 2);
    cursor += capWs[i]! + (i < keys.length - 1 ? gapK * 2 + plusW : 0);
  }
  const chipCX = cursor + labelGap + chipW / 2;

  if (showFlash) {
    const ring = new Graphics()
      .circle(0, 0, capH * 0.85)
      .stroke({ color: accent, width: Math.max(3, capH * 0.09) });
    ring.position.set(keyCenters[keys.length - 1]!, 0);
    ring.alpha = 0;
    ring.scale.set(0.6);
    group.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 0.85, start: tc, duration: 0.05, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.85, to: 0, start: tc + 0.05, duration: 0.45, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.6, to: 2.1, start: tc, duration: 0.5, ease: outCubic })
      .to(ring, { prop: "scale.y", from: 0.6, to: 2.1, start: tc, duration: 0.5, ease: outCubic });
  }

  // --- Keycaps (side face + sinking cap) with "+" separators between. ---
  keys.forEach((key, i) => {
    const capW = capWs[i]!;
    const keyG = new Container();
    keyG.position.set(keyCenters[i]!, 0);
    keyG.scale.set(0);
    group.addChild(keyG);

    const e = Math.round(capH * 0.05);
    const off = Math.round(capH * 0.1);
    const shadow = new Graphics()
      .roundRect(-capW / 2 - e, -capH / 2 - e + off, capW + e * 2, capH + depth + e * 2, capR + e)
      .fill("#000000");
    shadow.alpha = 0.16;
    keyG.addChild(shadow);

    keyG.addChild(new Graphics().roundRect(-capW / 2, -capH / 2 + depth, capW, capH, capR).fill(keyEdge));

    const capC = new Container();
    keyG.addChild(capC);
    capC.addChild(new Graphics().roundRect(-capW / 2, -capH / 2, capW, capH, capR).fill(keyBg));
    const glyph = makeText(fonts, {
      text: key,
      role: "body",
      weight: 700,
      size: keySizes[i]!,
      color: textColor,
      anchor: 0.5,
    });
    glyph.position.set(0, -Math.round(depth * 0.1));
    capC.addChild(glyph);

    // Pop in, press down (and hold), then release with a springy back-ease.
    const popStart = 0.15 + i * 0.12;
    const pi = P0 + i * PRESS_GAP;
    timeline
      .to(keyG, { prop: "scale.x", from: 0, to: 1, start: popStart, duration: 0.55, ease: spring(0.5) })
      .to(keyG, { prop: "scale.y", from: 0, to: 1, start: popStart, duration: 0.55, ease: spring(0.5) })
      .to(capC, { prop: "y", from: 0, to: pressY, start: pi, duration: 0.11, ease: inQuad })
      .to(capC, { prop: "y", from: pressY, to: 0, start: R + i * 0.05, duration: 0.3, ease: makeOutBack(2.6) })
      .to(shadow, { prop: "alpha", from: 0.16, to: 0.09, start: pi, duration: 0.11, ease: inQuad })
      .to(shadow, { prop: "alpha", from: 0.09, to: 0.16, start: R + i * 0.05, duration: 0.3, ease: outQuad });

    if (showPlus && i < keys.length - 1) {
      const plus = makeText(fonts, {
        text: "+",
        role: "body",
        weight: 700,
        size: plusSize,
        color: textColor,
        anchor: 0.5,
      });
      plus.position.set(keyCenters[i]! + capW / 2 + gapK + plusW / 2, 0);
      plus.alpha = 0;
      group.addChild(plus);
      timeline.to(plus, { prop: "alpha", from: 0, to: 0.7, start: 0.35 + i * 0.12, duration: 0.3, ease: outQuad });
    }
  });

  // --- Action chip pops beside the row when the chord completes. ---
  const chip = new Container();
  chip.position.set(chipCX, 0);
  chip.scale.set(0);
  group.addChild(chip);
  const ce = Math.round(chipH * 0.05);
  const cOff = Math.round(chipH * 0.09);
  chip.addChild(
    new Graphics()
      .roundRect(-chipW / 2 - ce, -chipH / 2 - ce + cOff, chipW + ce * 2, chipH + ce * 2, chipH / 2 + ce)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(accent));
  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 700,
    size: labelSize,
    color: accentText,
    anchor: 0.5,
  });
  chip.addChild(labelText);
  timeline
    .to(chip, { prop: "scale.x", from: 0, to: 1, start: tc + 0.08, duration: 0.55, ease: spring(0.42) })
    .to(chip, { prop: "scale.y", from: 0, to: 1, start: tc + 0.08, duration: 0.55, ease: spring(0.42) });

  return { timeline, duration: 4.0 };
}

export const keyPress: TemplateDefinition = {
  id: "key-press",
  name: "Key Press",
  tagline: "Keycaps press down in sequence and a little action label pops beside.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { keys: "body", label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "keys", type: "textlist", label: "Keys", default: ["Ctrl", "S"], minItems: 1, maxItems: 3, maxLength: 10 },
    { key: "label", type: "text", label: "Action label", default: "Save", maxLength: 18, shrinkToFit: true },
    { key: "showPlus", type: "toggle", label: "Plus separators", default: true },
    { key: "showFlash", type: "toggle", label: "Completion flash", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Key text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
