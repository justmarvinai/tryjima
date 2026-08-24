import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const DEG = Math.PI / 180;

const PALETTES: Palette[] = [
  { id: "classic-slate", name: "Classic slate", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#101014", onAccent: "#FFFFFF" } },
  { id: "crimson-reel", name: "Crimson reel", colors: { background: "#FFF5F2", textColor: "#2A0A06", accent: "#C41E3A", onAccent: "#FFFFFF" } },
  { id: "studio-navy", name: "Studio navy", colors: { background: "#0B1220", textColor: "#FFFFFF", accent: "#4D96FF", onAccent: "#0B1220" } },
  { id: "backlot-amber", name: "Backlot amber", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF8A3D", onAccent: "#101014" } },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const s = hex.replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
/** Blend hex `a` toward hex `b` by `t` (0..1). Pure, deterministic. */
function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const ch = (x: number, y: number): string =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(A.r, B.r)}${ch(A.g, B.g)}${ch(A.b, B.b)}`;
}

/**
 * A `w`×`h` rect filled with `base` and overlaid with diagonal parallelogram
 * stripes of `stripe`, clipped to the exact bounds via a mask. Used for the
 * clapperboard's arm and slate stripes.
 */
function stripedRect(x0: number, y0: number, w: number, h: number, base: string, stripe: string, count: number): Container {
  const c = new Container();
  c.addChild(new Graphics().rect(x0, y0, w, h).fill(base));
  const stripeW = w / count;
  const shift = h * 0.55;
  for (let i = 0; i < count; i += 2) {
    const x = x0 + i * stripeW;
    c.addChild(
      new Graphics()
        .poly([x, y0, x + stripeW, y0, x + stripeW + shift, y0 + h, x + shift, y0 + h])
        .fill(stripe),
    );
  }
  const mask = new Graphics().rect(x0, y0, w, h).fill("#ffffff");
  c.addChild(mask);
  c.mask = mask;
  return c;
}

/** Shrink-to-fit: re-make one size smaller if the text would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(10, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

interface ClapLayout {
  boardWFrac: number;
  boardCyFrac: number;
  titleFontFrac: number;
  sceneFontFrac: number;
}
function clapLayout(aspect: Aspect): ClapLayout {
  switch (aspect) {
    case "16:9":
      return { boardWFrac: 0.3, boardCyFrac: 0.34, titleFontFrac: 0.058, sceneFontFrac: 0.024 };
    case "9:16":
      return { boardWFrac: 0.58, boardCyFrac: 0.28, titleFontFrac: 0.092, sceneFontFrac: 0.036 };
    case "4:5":
      return { boardWFrac: 0.52, boardCyFrac: 0.3, titleFontFrac: 0.086, sceneFontFrac: 0.034 };
    case "1:1":
    default:
      return { boardWFrac: 0.46, boardCyFrac: 0.3, titleFontFrac: 0.082, sceneFontFrac: 0.032 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#101014"));
  const onAccent = pcol("onAccent", "#FFFFFF");
  const title = str(values.title, "Scene One");
  const scene = str(values.scene, "TAKE 1");
  const showStripes = on(values.showStripes);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = clapLayout(ctx.aspect);
  const boardW = minDim * L.boardWFrac;
  const boardH = boardW * 0.62;
  const armH = boardH * 0.36;
  const boardCx = w / 2;
  const boardCy = h * L.boardCyFrac;
  const boardTop = boardCy - boardH / 2;
  const boardLeft = boardCx - boardW / 2;
  const bodyTop = boardTop + armH;
  const bodyH = boardH - armH;
  const bodyBottom = bodyTop + bodyH;
  const r = boardH * 0.07;

  const timeline = new JimaTimeline();

  const clapGroup = new Container();
  clapGroup.label = "clap";
  root.addChild(clapGroup);

  // Impact ring, behind the board.
  const ring = new Graphics().circle(0, 0, boardW * 0.34).stroke({ color: accent, width: Math.max(3, minDim * 0.006) });
  ring.position.set(boardCx, boardCy);
  ring.scale.set(0.7);
  ring.alpha = 0;
  clapGroup.addChild(ring);

  // Soft drop shadow.
  clapGroup.addChild(
    new Graphics()
      .ellipse(boardCx, bodyBottom + boardH * 0.05, boardW * 0.46, boardH * 0.08)
      .fill({ color: "#000000", alpha: 0.15 }),
  );

  // Body — the fixed lower part of the slate.
  clapGroup.addChild(new Graphics().roundRect(boardLeft, bodyTop, boardW, bodyH, r).fill(accent));
  if (showStripes) {
    clapGroup.addChild(stripedRect(boardLeft, bodyTop, boardW, bodyH * 0.26, accent, onAccent, 9));
  }

  // Arm — the clapstick, pivoting at the board's top-left corner (the hinge).
  const armPivotX = boardLeft;
  const armPivotY = bodyTop;
  const OPEN = -26 * DEG;
  const arm = new Container();
  arm.position.set(armPivotX, armPivotY);
  arm.rotation = OPEN;
  if (showStripes) {
    arm.addChild(stripedRect(0, -armH, boardW, armH, accent, onAccent, 9));
  } else {
    arm.addChild(new Graphics().rect(0, -armH, boardW, armH).fill(mixHex(accent, "#000000", 0.2)));
  }
  clapGroup.addChild(arm);

  // Hinge pin.
  clapGroup.addChild(new Graphics().circle(armPivotX, armPivotY, boardH * 0.028).fill(onAccent));

  // The board fades in as one unit.
  clapGroup.alpha = 0;
  timeline.to(clapGroup, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.3, ease: outQuad });

  // The clap: the arm swings down and shut — the overshoot in the ease itself
  // reads as the bounce (it rotates a touch past closed, then settles at 0).
  const CLAP = 0.45;
  const CLAP_DUR = 0.28;
  timeline.to(arm, { prop: "rotation", from: OPEN, to: 0, start: CLAP, duration: CLAP_DUR, ease: makeOutBack(2.0) });

  // A few decaying rattle wiggles after impact.
  const rattleStart = CLAP + CLAP_DUR;
  const rattle: [from: number, to: number][] = [
    [0, 3 * DEG],
    [3 * DEG, -1.6 * DEG],
    [-1.6 * DEG, 0.8 * DEG],
    [0.8 * DEG, 0],
  ];
  rattle.forEach(([from, to], i) => {
    timeline.to(arm, { prop: "rotation", from, to, start: rattleStart + i * 0.07, duration: 0.07, ease: outQuad });
  });

  // Impact ring pops out and fades.
  timeline
    .to(ring, { prop: "scale.x", from: 0.7, to: 1.7, start: CLAP + 0.02, duration: 0.5, ease: outExpo })
    .to(ring, { prop: "scale.y", from: 0.7, to: 1.7, start: CLAP + 0.02, duration: 0.5, ease: outExpo })
    .to(ring, { prop: "alpha", from: 0.85, to: 0, start: CLAP + 0.02, duration: 0.5, ease: outQuad });

  // Scene/take kicker + title pop in just after the clap.
  const hasScene = scene.length > 0;
  const sceneSize = Math.round(w * L.sceneFontFrac);
  const titleSize = Math.round(w * L.titleFontFrac);
  const kickerY = bodyBottom + minDim * 0.1;
  const titleY = hasScene ? kickerY + sceneSize * 1.3 : kickerY;
  const sceneAt = rattleStart + 0.33;
  const titleAt = sceneAt + 0.08;

  if (hasScene) {
    const sceneText = fitText(
      fonts,
      {
        text: scene,
        role: "body",
        weight: 700,
        size: sceneSize,
        color: accent,
        anchor: 0.5,
        align: "center",
        letterSpacing: Math.round(sceneSize * 0.16),
      },
      w * 0.86,
    );
    sceneText.position.set(boardCx, kickerY);
    sceneText.alpha = 0;
    sceneText.scale.set(0.6);
    root.addChild(sceneText);
    timeline
      .to(sceneText, { prop: "alpha", from: 0, to: 1, start: sceneAt, duration: 0.3, ease: outQuad })
      .to(sceneText, { prop: "scale.x", from: 0.6, to: 1, start: sceneAt, duration: 0.45, ease: makeOutBack(2) })
      .to(sceneText, { prop: "scale.y", from: 0.6, to: 1, start: sceneAt, duration: 0.45, ease: makeOutBack(2) });
  }

  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
    w * 0.86,
  );
  titleText.position.set(boardCx, titleY);
  titleText.alpha = 0;
  titleText.scale.set(0.6);
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: titleAt, duration: 0.35, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 0.6, to: 1, start: titleAt, duration: 0.5, ease: makeOutBack(1.8) })
    .to(titleText, { prop: "scale.y", from: 0.6, to: 1, start: titleAt, duration: 0.5, ease: makeOutBack(1.8) });

  return { timeline, duration: 4.2 };
}

export const clapIntro: TemplateDefinition = {
  id: "clap-intro",
  name: "Clap Intro",
  tagline: "A clapperboard snaps shut, then your title and scene pop in.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { title: "display", scene: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Scene One", maxLength: 32, shrinkToFit: true },
    { key: "scene", type: "text", label: "Scene / take", default: "TAKE 1", maxLength: 16, optional: true },
    { key: "showStripes", type: "toggle", label: "Clapper stripes", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Board color", default: "", optional: true },
  ],
  build,
};
