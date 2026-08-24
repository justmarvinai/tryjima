import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  linear,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { verticalScrimTexture } from "../shared/scrim";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#101014", accent: "#FF4D1C", textColor: "#FFFFFF", scrim: "#0A0A0F" } },
  { id: "grape", name: "Grape", colors: { background: "#160A24", accent: "#7C5CFF", textColor: "#F7EEFF", scrim: "#0C0518" } },
  { id: "sky", name: "Sky", colors: { background: "#08182C", accent: "#38C7FF", textColor: "#EFF8FF", scrim: "#04101F" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#0F1408", accent: "#84CC16", textColor: "#F4FBE8", scrim: "#080B04" } },
];

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const scrimColor = pc("scrim", "#0A0A0F");
  const title = str(values.title, "Introducing");
  const caption = str(values.caption, "Something new");
  const showAccentBar = values.accentBar !== false;
  const showAccentRule = values.accentRule !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const m = Math.round(Math.min(w, h) * 0.05);
  const mx = m;
  const my = m;
  const imgW = w - m * 2;
  const imgH = h - m * 2;
  const cx = mx + imgW / 2;
  const cy = my + imgH / 2;
  const r = Math.min(imgW, imgH) * 0.045;
  const timeline = new JimaTimeline();
  const DUR = 4.0;

  // Image holder (Ken Burns scale about its center) — sprite or placeholder.
  const imageHolder = new Container();
  imageHolder.position.set(cx, cy);
  const tex = images.image ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(imgW / tex.width, imgH / tex.height);
    s.scale.set(cover);
    s.position.set(0, 0);
    imageHolder.addChild(s);
  } else {
    imageHolder.addChild(new Graphics().rect(-imgW / 2, -imgH / 2, imgW, imgH).fill(accent));
    for (const [bx, by, tint, a] of [
      [-0.22, -0.24, "#FFFFFF", 0.5],
      [0.28, 0.26, "#7C5CFF", 0.45],
    ] as const) {
      const blob = new Sprite(radialGlowTexture());
      blob.anchor.set(0.5);
      blob.tint = tint;
      blob.width = blob.height = Math.max(imgW, imgH) * 0.95;
      blob.alpha = a;
      blob.position.set(imgW * bx, imgH * by);
      imageHolder.addChild(blob);
    }
  }
  root.addChild(imageHolder);

  // Reveal wipe: a rounded-rect mask grows left→right.
  const revealMask = new Graphics().roundRect(0, 0, imgW, imgH, r).fill(0xffffff);
  revealMask.position.set(mx, my);
  revealMask.scale.set(0, 1);
  root.addChild(revealMask);
  imageHolder.mask = revealMask;
  timeline.to(revealMask, { prop: "scale.x", from: 0, to: 1, start: 0.2, duration: 0.9, ease: outExpo });

  // Subtle Ken Burns zoom-in (stays ≥1 so the mask never shows a gap).
  timeline
    .to(imageHolder, { prop: "scale.x", from: 1.0, to: 1.07, start: 0.2, duration: DUR - 0.2, ease: linear })
    .to(imageHolder, { prop: "scale.y", from: 1.0, to: 1.07, start: 0.2, duration: DUR - 0.2, ease: linear });

  // Accent bar rides the leading edge, then sweeps off + fades.
  if (showAccentBar) {
    const barW = Math.max(10, w * 0.012);
    const bar = new Graphics().roundRect(-barW / 2, -imgH / 2, barW, imgH, barW / 2).fill(accent);
    bar.position.set(mx, cy);
    bar.alpha = 0;
    root.addChild(bar);
    timeline
      .to(bar, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.15, ease: outQuad })
      .to(bar, { prop: "x", from: mx, to: mx + imgW + barW, start: 0.2, duration: 0.9, ease: outExpo })
      .to(bar, { prop: "alpha", from: 1, to: 0, start: 1.0, duration: 0.3, ease: outQuad });
  }

  // Bottom scrim (clipped to the rounded image), behind the caption.
  const scrimH = imgH * 0.42;
  const scrim = new Sprite(verticalScrimTexture());
  scrim.tint = scrimColor;
  scrim.width = imgW;
  scrim.height = scrimH;
  scrim.position.set(mx, my + imgH - scrimH);
  scrim.alpha = 0;
  const scrimMask = new Graphics().roundRect(mx, my, imgW, imgH, r).fill(0xffffff);
  root.addChild(scrim, scrimMask);
  scrim.mask = scrimMask;
  timeline.to(scrim, { prop: "alpha", from: 0, to: 0.85, start: 0.9, duration: 0.6, ease: outQuad });

  // Caption block — kept above the 9:16 bottom safe zone.
  const botSafe = ctx.aspect === "9:16" ? 400 : m;
  const padX = mx + imgW * 0.06;
  const titleSize = Math.round(w * (ctx.aspect === "16:9" ? 0.058 : 0.07));
  const capSize = Math.round(titleSize * 0.42);
  const hasCaption = caption.length > 0;
  const blockBottom = Math.min(my + imgH - imgH * 0.06, h - botSafe - Math.min(w, h) * 0.03);
  const titleBaseY = hasCaption ? blockBottom - capSize * 1.5 : blockBottom;

  // Accent rule above the title.
  if (showAccentRule) {
    const ruleW = titleSize * 1.3;
    const rule = new Graphics().roundRect(0, 0, ruleW, Math.max(4, titleSize * 0.1), 3).fill(accent);
    rule.position.set(padX, titleBaseY - titleSize * 1.15);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 1.1, duration: 0.4, ease: outExpo });
  }

  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 1 } },
    imgW * 0.88,
  );
  titleText.position.set(padX, titleBaseY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 1.2, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleBaseY + 24, to: titleBaseY, start: 1.2, duration: 0.6, ease: outQuint });

  if (hasCaption) {
    const capText = fitText(
      fonts,
      { text: caption, role: "body", weight: 500, size: capSize, color: textColor, anchor: { x: 0, y: 1 } },
      imgW * 0.88,
    );
    capText.position.set(padX, blockBottom);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 0.85, start: 1.45, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: blockBottom + 16, to: blockBottom, start: 1.45, duration: 0.6, ease: outQuint });
  }

  return { timeline, duration: DUR };
}

export const imageReveal: TemplateDefinition = {
  id: "image-reveal",
  name: "Image Reveal",
  tagline: "A hero image wipes in with a cinematic move.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Image", default: "", optional: true, help: "Fills the frame; best with a landscape or portrait photo." },
    { key: "title", type: "text", label: "Title", default: "Introducing", maxLength: 36, shrinkToFit: true },
    { key: "caption", type: "text", label: "Caption", default: "Something new", maxLength: 48, optional: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "accentRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
