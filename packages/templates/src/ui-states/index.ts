import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  inOutQuad,
  inOutCubic,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { pointerCursor } from "../shared/ui";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

function strList(values: Values, key: string, fallback: string[]): string[] {
  const raw = values[key];
  const out = fallback.slice();
  if (Array.isArray(raw)) {
    raw.forEach((s, i) => {
      if (typeof s === "string" && s.length > 0 && i < out.length) out[i] = s;
    });
  }
  return out;
}

// One component, four states. Every change is a soft morph — fills crossfade,
// the elevation sprite grows and settles, the label swaps under the cursor —
// so it reads as a single object transforming rather than four screens cutting.
const PALETTES: Palette[] = [
  {
    id: "daylight",
    name: "Daylight",
    colors: {
      background: "#F6F7F9", surface: "#FFFFFF", surfaceHover: "#EDF2FF", border: "#DCE1E8",
      textColor: "#14181F", muted: "#626C7B", accent: "#2A5FE0", onAccent: "#FFFFFF",
      success: "#12855A", onSuccess: "#FFFFFF",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    colors: {
      background: "#101318", surface: "#1A1F27", surfaceHover: "#232B38", border: "#2C3441",
      textColor: "#EEF1F6", muted: "#8A94A4", accent: "#6E8BFF", onAccent: "#0B1020",
      success: "#34D399", onSuccess: "#06231A",
    },
  },
  {
    id: "linen",
    name: "Linen",
    colors: {
      background: "#F7F3EC", surface: "#FFFFFF", surfaceHover: "#F6EBDF", border: "#E4DCCF",
      textColor: "#1E1A14", muted: "#6E6659", accent: "#B04E26", onAccent: "#FFFFFF",
      success: "#2F7D4F", onSuccess: "#FFFFFF",
    },
  },
  {
    id: "orchid",
    name: "Orchid",
    colors: {
      background: "#F5F2FA", surface: "#FFFFFF", surfaceHover: "#EFE9FB", border: "#E0D9EE",
      textColor: "#1B1330", muted: "#6F6685", accent: "#6534D6", onAccent: "#FFFFFF",
      success: "#1F7A55", onSuccess: "#FFFFFF",
    },
  },
];

interface Cfg {
  btnHF: number;
  btnMinWF: number;
  labelF: number;
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { btnHF: 0.128, btnMinWF: 0.56, labelF: 0.046 },
  "1:1": { btnHF: 0.125, btnMinWF: 0.58, labelF: 0.046 },
  "4:5": { btnHF: 0.12, btnMinWF: 0.6, labelF: 0.044 },
  "9:16": { btnHF: 0.115, btnMinWF: 0.64, labelF: 0.042 },
};

const HOVER = 1.2;
const HOVER_DUR = 0.55;
const ACTIVE = 2.25;
const ACTIVE_DUR = 0.42;
const SUCCESS = 3.2;
const SUCCESS_DUR = 0.62;
const CAP_IN = [0.55, 1.3, 2.32, 3.32];
const DEFAULT_STATES = ["Default", "Hover", "Active", "Success"];
const DURATION = 5.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F7F9"));
  const textColor = str(values.textColor, pc("textColor", "#14181F"));
  const accent = str(values.accent, pc("accent", "#2A5FE0"));
  const surface = pc("surface", "#FFFFFF");
  const surfaceHover = pc("surfaceHover", "#EDF2FF");
  const border = pc("border", "#DCE1E8");
  const muted = pc("muted", "#626C7B");
  const onAccent = pc("onAccent", "#FFFFFF");
  const success = pc("success", "#12855A");
  const onSuccess = pc("onSuccess", "#FFFFFF");

  const componentName = str(values.componentName, "Primary button");
  const label = str(values.label, "Get started");
  const doneLabel = str(values.doneLabel, "Done");
  const captions = strList(values, "stateLabels", DEFAULT_STATES);
  const showCursor = on(values.showCursor);
  const showTrack = on(values.showTrack);
  const showShadow = on(values.showShadow);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];
  const safe = safeRect(ctx.aspect);
  const timeline = new JimaTimeline();

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  // --- Metrics ---
  const btnH = minDim * cfg.btnHF;
  const btnR = btnH * 0.3;
  const padX = btnH * 0.78;
  const labelSize0 = Math.round(minDim * cfg.labelF);
  const maxBtnW = safe.width * 0.92;
  const labelSize = fitSize(fonts, label, "display", 600, labelSize0, maxBtnW - padX * 2);
  const checkS = labelSize * 0.9;
  const checkGap = labelSize * 0.46;
  const doneSize = fitSize(fonts, doneLabel, "display", 600, labelSize, maxBtnW - padX * 2 - checkS - checkGap);

  const labelW = fonts.measure(label, { family: fonts.family("display"), weight: 600, size: labelSize });
  const doneW = fonts.measure(doneLabel, { family: fonts.family("display"), weight: 600, size: doneSize });
  const btnW = Math.min(
    maxBtnW,
    Math.max(minDim * cfg.btnMinWF, labelW + padX * 2, doneW + checkS + checkGap + padX * 2),
  );

  const eyeSize = Math.round(minDim * 0.022);
  const capSize = Math.round(minDim * 0.036);
  const trackH = Math.max(4, Math.round(minDim * 0.007));
  const trackW = Math.min(safe.width * 0.6, minDim * 0.34);
  const gapEye = minDim * 0.05;
  const gapCap = minDim * 0.055;
  const gapTrack = minDim * 0.03;

  const blockH =
    eyeSize * 1.2 + gapEye + btnH + gapCap + capSize * 1.2 + (showTrack ? gapTrack + trackH : 0);
  let cursorY = safe.y + (safe.height - blockH) / 2;
  const cx = w / 2;

  // --- Eyebrow: what the component is ---
  const eyeText = makeText(fonts, {
    text: componentName,
    role: "body",
    weight: 600,
    size: fitSize(fonts, componentName, "body", 600, eyeSize, safe.width * 0.8),
    color: muted,
    anchor: 0.5,
    letterSpacing: eyeSize * 0.16,
  });
  const eyeY = cursorY + eyeSize * 0.6;
  eyeText.position.set(cx, eyeY);
  eyeText.alpha = 0;
  root.addChild(eyeText);
  timeline
    .to(eyeText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
    .to(eyeText, { prop: "y", from: eyeY + minDim * 0.01, to: eyeY, start: 0.1, duration: 0.6, ease: outQuint });
  cursorY += eyeSize * 1.2 + gapEye;

  // --- The component ---
  const btnCy = cursorY + btnH / 2;

  if (showShadow) {
    const shadow = new Sprite(radialGlowTexture());
    shadow.anchor.set(0.5);
    shadow.width = btnW * 1.02;
    shadow.height = btnH * 1.5;
    shadow.tint = "#000000";
    shadow.alpha = 0;
    shadow.position.set(cx, btnCy + btnH * 0.55);
    root.addChild(shadow);
    const shY = (f: number): number => btnCy + btnH * f;
    const shS = shadow.scale.x;
    timeline
      .to(shadow, { prop: "alpha", from: 0, to: 0.15, start: 0.05, duration: 0.6, ease: outQuad })
      .to(shadow, { prop: "alpha", from: 0.15, to: 0.24, start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
      .to(shadow, { prop: "alpha", from: 0.24, to: 0.11, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
      .to(shadow, { prop: "alpha", from: 0.11, to: 0.2, start: SUCCESS, duration: SUCCESS_DUR, ease: inOutCubic })
      .to(shadow, { prop: "y", from: shY(0.55), to: shY(0.78), start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
      .to(shadow, { prop: "y", from: shY(0.78), to: shY(0.42), start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
      .to(shadow, { prop: "y", from: shY(0.42), to: shY(0.68), start: SUCCESS, duration: SUCCESS_DUR, ease: inOutCubic })
      .to(shadow, { prop: "scale.x", from: shS, to: shS * 1.08, start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
      .to(shadow, { prop: "scale.x", from: shS * 1.08, to: shS * 0.94, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
      .to(shadow, { prop: "scale.x", from: shS * 0.94, to: shS * 1.04, start: SUCCESS, duration: SUCCESS_DUR, ease: inOutCubic });
  }

  const btn = new Container();
  btn.position.set(cx, btnCy);
  btn.alpha = 0;
  btn.scale.set(0.955);
  root.addChild(btn);
  timeline
    .to(btn, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.5, ease: outQuad })
    .to(btn, { prop: "scale.x", from: 0.955, to: 1, start: 0, duration: 0.8, ease: outExpo })
    .to(btn, { prop: "scale.y", from: 0.955, to: 1, start: 0, duration: 0.8, ease: outExpo })
    .to(btn, { prop: "y", from: btnCy + minDim * 0.014, to: btnCy, start: 0, duration: 0.85, ease: outExpo })
    // Elevation + press, carried on the component itself.
    .to(btn, { prop: "y", from: btnCy, to: btnCy - minDim * 0.008, start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
    .to(btn, { prop: "y", from: btnCy - minDim * 0.008, to: btnCy + minDim * 0.002, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
    .to(btn, { prop: "y", from: btnCy + minDim * 0.002, to: btnCy - minDim * 0.004, start: SUCCESS, duration: SUCCESS_DUR, ease: inOutCubic })
    .to(btn, { prop: "scale.x", from: 1, to: 1.02, start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
    .to(btn, { prop: "scale.y", from: 1, to: 1.02, start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
    .to(btn, { prop: "scale.x", from: 1.02, to: 0.982, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
    .to(btn, { prop: "scale.y", from: 1.02, to: 0.982, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
    .to(btn, { prop: "scale.x", from: 0.982, to: 1, start: SUCCESS, duration: SUCCESS_DUR, ease: inOutCubic })
    .to(btn, { prop: "scale.y", from: 0.982, to: 1, start: SUCCESS, duration: SUCCESS_DUR, ease: inOutCubic });

  const plate = (color: string): Graphics =>
    new Graphics().roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR).fill(color);

  const fillDefault = plate(surface);
  const fillHover = plate(surfaceHover);
  const fillActive = plate(accent);
  const fillSuccess = plate(success);
  fillHover.alpha = 0;
  fillActive.alpha = 0;
  fillSuccess.alpha = 0;
  btn.addChild(fillDefault, fillHover, fillActive, fillSuccess);
  timeline
    .to(fillDefault, { prop: "alpha", from: 1, to: 0, start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
    .to(fillHover, { prop: "alpha", from: 0, to: 1, start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
    .to(fillHover, { prop: "alpha", from: 1, to: 0, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
    .to(fillActive, { prop: "alpha", from: 0, to: 1, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
    .to(fillActive, { prop: "alpha", from: 1, to: 0, start: SUCCESS, duration: SUCCESS_DUR, ease: inOutCubic })
    .to(fillSuccess, { prop: "alpha", from: 0, to: 1, start: SUCCESS, duration: SUCCESS_DUR, ease: inOutCubic });

  const strokeW = Math.max(1.5, btnH * 0.022);
  const ringRest = new Graphics()
    .roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR)
    .stroke({ color: border, width: strokeW });
  const ringHover = new Graphics()
    .roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR)
    .stroke({ color: accent, width: strokeW });
  ringHover.alpha = 0;
  btn.addChild(ringRest, ringHover);
  timeline
    .to(ringRest, { prop: "alpha", from: 1, to: 0, start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
    .to(ringHover, { prop: "alpha", from: 0, to: 1, start: HOVER, duration: HOVER_DUR, ease: inOutCubic })
    .to(ringHover, { prop: "alpha", from: 1, to: 0, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic });

  // Labels: the same word in two inks (light fill / solid fill), then the
  // confirmation pair. They crossfade, so the wording appears to morph.
  const labelRest = makeText(fonts, {
    text: label, role: "display", weight: 600, size: labelSize, color: textColor, anchor: 0.5,
  });
  const labelOn = makeText(fonts, {
    text: label, role: "display", weight: 600, size: labelSize, color: onAccent, anchor: 0.5,
  });
  labelOn.alpha = 0;
  btn.addChild(labelRest, labelOn);
  // The ink swap lags the fill so the crossfade lands while the solid colour is
  // already dominant — no washed-out mid-point.
  timeline
    .to(labelRest, { prop: "alpha", from: 1, to: 0, start: ACTIVE + 0.16, duration: 0.26, ease: inOutCubic })
    .to(labelOn, { prop: "alpha", from: 0, to: 1, start: ACTIVE + 0.16, duration: 0.26, ease: inOutCubic })
    .to(labelOn, { prop: "alpha", from: 1, to: 0, start: SUCCESS, duration: 0.34, ease: inOutCubic });

  const donePair = new Container();
  const pairW = checkS + checkGap + doneW;
  const check = makeIcon("check", checkS, { color: onSuccess });
  check.position.set(-pairW / 2 + checkS / 2, 0);
  check.alpha = 0;
  check.scale.set(0.6);
  const doneText = makeText(fonts, {
    text: doneLabel, role: "display", weight: 600, size: doneSize, color: onSuccess, anchor: { x: 0, y: 0.5 },
  });
  doneText.position.set(-pairW / 2 + checkS + checkGap, 0);
  donePair.addChild(check, doneText);
  donePair.alpha = 0;
  btn.addChild(donePair);
  timeline
    .to(donePair, { prop: "alpha", from: 0, to: 1, start: SUCCESS + 0.16, duration: 0.42, ease: inOutCubic })
    .to(donePair, { prop: "y", from: minDim * 0.009, to: 0, start: SUCCESS + 0.16, duration: 0.6, ease: outQuint })
    .to(check, { prop: "alpha", from: 0, to: 1, start: SUCCESS + 0.24, duration: 0.4, ease: outQuad })
    .to(check, { prop: "scale.x", from: 0.6, to: 1, start: SUCCESS + 0.24, duration: 0.5, ease: outExpo })
    .to(check, { prop: "scale.y", from: 0.6, to: 1, start: SUCCESS + 0.24, duration: 0.5, ease: outExpo });

  cursorY += btnH;

  // --- Cursor: arrives for hover, dips on press, leaves once it is done ---
  if (showCursor) {
    const curS = btnH * 0.62;
    const cur = pointerCursor(curS, textColor, bg);
    const curX = cx + btnW * 0.22;
    const curY = btnCy + btnH * 0.22;
    cur.position.set(curX + minDim * 0.09, curY + minDim * 0.07);
    cur.alpha = 0;
    root.addChild(cur);
    timeline
      .to(cur, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.4, ease: outQuad })
      .to(cur, { prop: "x", from: curX + minDim * 0.09, to: curX, start: 0.95, duration: 0.75, ease: outQuint })
      .to(cur, { prop: "y", from: curY + minDim * 0.07, to: curY, start: 0.95, duration: 0.75, ease: outQuint })
      .to(cur, { prop: "y", from: curY, to: curY + minDim * 0.007, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
      .to(cur, { prop: "scale.x", from: 1, to: 0.94, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
      .to(cur, { prop: "scale.y", from: 1, to: 0.94, start: ACTIVE, duration: ACTIVE_DUR, ease: inOutCubic })
      .to(cur, { prop: "y", from: curY + minDim * 0.007, to: curY + minDim * 0.055, start: SUCCESS + 0.15, duration: 0.7, ease: inOutQuad })
      .to(cur, { prop: "x", from: curX, to: curX + minDim * 0.05, start: SUCCESS + 0.15, duration: 0.7, ease: inOutQuad })
      .to(cur, { prop: "alpha", from: 1, to: 0, start: SUCCESS + 0.15, duration: 0.5, ease: inOutQuad });
  }

  // --- State caption ---
  const capY = cursorY + gapCap + capSize * 0.6;
  captions.forEach((text, i) => {
    const capText = makeText(fonts, {
      text,
      role: "display",
      weight: 600,
      size: fitSize(fonts, text, "display", 600, capSize, safe.width * 0.85),
      color: textColor,
      anchor: 0.5,
      letterSpacing: -capSize * 0.01,
    });
    capText.position.set(cx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    const inAt = CAP_IN[i] ?? 0.55;
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 1, start: inAt, duration: 0.4, ease: outQuad })
      .to(capText, { prop: "y", from: capY + minDim * 0.012, to: capY, start: inAt, duration: 0.6, ease: outQuint });
    const next = CAP_IN[i + 1];
    if (next !== undefined) {
      timeline
        .to(capText, { prop: "alpha", from: 1, to: 0, start: next - 0.18, duration: 0.26, ease: inOutQuad })
        .to(capText, { prop: "y", from: capY, to: capY - minDim * 0.01, start: next - 0.18, duration: 0.26, ease: inOutQuad });
    }
  });
  cursorY += gapCap + capSize * 1.2;

  // --- State track ---
  if (showTrack) {
    const segGap = trackW * 0.035;
    const segW = (trackW - segGap * 3) / 4;
    const trackY = cursorY + gapTrack;
    const trackLeft = cx - trackW / 2;
    for (let i = 0; i < 4; i++) {
      const x = trackLeft + i * (segW + segGap);
      const seg = new Graphics().roundRect(0, 0, segW, trackH, trackH / 2).fill({ color: muted, alpha: 0.32 });
      seg.position.set(x, trackY);
      seg.alpha = 0;
      const fill = new Graphics().roundRect(0, 0, segW, trackH, trackH / 2).fill(accent);
      fill.position.set(x, trackY);
      fill.scale.x = 0;
      root.addChild(seg, fill);
      const at = CAP_IN[i] ?? 0.55;
      timeline
        .to(seg, { prop: "alpha", from: 0, to: 1, start: 0.5 + i * 0.06, duration: 0.4, ease: outQuad })
        .to(fill, { prop: "scale.x", from: 0, to: 1, start: at, duration: 0.45, ease: outExpo });
    }
  }

  return { timeline, duration: DURATION };
}

export const uiStates: TemplateDefinition = {
  id: "ui-states",
  name: "UI States",
  tagline: "One button morphs through default, hover, active and success.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.6,
  fontRoles: { label: "display", doneLabel: "display", componentName: "body", stateLabels: "display" },
  palettes: PALETTES,
  fields: [
    { key: "componentName", type: "text", label: "Component name", default: "Primary button", maxLength: 26, shrinkToFit: true, optional: true },
    { key: "label", type: "text", label: "Button label", default: "Get started", maxLength: 20, shrinkToFit: true },
    { key: "doneLabel", type: "text", label: "Success label", default: "Done", maxLength: 16, shrinkToFit: true },
    {
      key: "stateLabels",
      type: "textlist",
      label: "State captions",
      default: DEFAULT_STATES,
      minItems: 4,
      maxItems: 4,
      maxLength: 18,
      help: "Four captions, one per state, in order.",
    },
    { key: "showCursor", type: "toggle", label: "Cursor", default: true },
    { key: "showTrack", type: "toggle", label: "State track", default: true },
    { key: "showShadow", type: "toggle", label: "Elevation shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
