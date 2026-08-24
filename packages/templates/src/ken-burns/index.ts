import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuint,
  outQuad,
  linear,
  safeZone,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { verticalScrimTexture } from "../shared/scrim";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

const PALETTES: Palette[] = [
  { id: "neutral", name: "Neutral", colors: { scrim: "#0A0A0F", accent: "#FF4D1C", captionColor: "#FFFFFF" } },
  { id: "warm", name: "Warm", colors: { scrim: "#2A1206", accent: "#FF8A3D", captionColor: "#FFF6EF" } },
  { id: "cool", name: "Cool", colors: { scrim: "#061024", accent: "#38C7FF", captionColor: "#EFF8FF" } },
  { id: "duotone-plum", name: "Duotone plum", colors: { scrim: "#1A0A24", accent: "#C05CFF", captionColor: "#F7EEFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const scrimColor = pc("scrim", "#0A0A0F");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const captionColor = pc("captionColor", "#FFFFFF");
  const caption = str(values.caption, "Golden hour in Lisbon");
  const handle = str(values.handle, "");
  const move = str(values.move, "zoom-in");
  const scrimAmt = num(values.scrim, 0.55);
  const showAccentBar = values.accentBar !== false;

  const timeline = new JimaTimeline();
  const DUR = 6.0;

  // Photo (cover-fit + Ken Burns) or a soft placeholder.
  const photoWrap = new Container();
  root.addChild(photoWrap);
  const tex = images.photo ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(size.width / tex.width, size.height / tex.height);
    s.scale.set(cover);
    s.position.set(size.width / 2, size.height / 2);
    photoWrap.addChild(s);
  } else {
    root.addChildAt(new Graphics().rect(0, 0, size.width, size.height).fill("#C9C4BC"), 0);
    for (const [cx, cy, tint] of [[0.3, 0.35, accent], [0.75, 0.7, "#7C5CFF"]] as const) {
      const blob = new Sprite(radialGlowTexture());
      blob.anchor.set(0.5);
      blob.tint = tint;
      blob.width = blob.height = Math.max(size.width, size.height) * 0.9;
      blob.alpha = 0.5;
      blob.position.set(size.width * cx, size.height * cy);
      photoWrap.addChild(blob);
    }
  }

  // Ken Burns transform on the wrapper (works for photo or placeholder).
  photoWrap.pivot.set(size.width / 2, size.height / 2);
  photoWrap.position.set(size.width / 2, size.height / 2);
  if (move === "zoom-in") {
    timeline.to(photoWrap, { prop: "scale.x", from: 1, to: 1.12, start: 0, duration: DUR, ease: linear });
    timeline.to(photoWrap, { prop: "scale.y", from: 1, to: 1.12, start: 0, duration: DUR, ease: linear });
  } else if (move === "zoom-out") {
    timeline.to(photoWrap, { prop: "scale.x", from: 1.12, to: 1, start: 0, duration: DUR, ease: linear });
    timeline.to(photoWrap, { prop: "scale.y", from: 1.12, to: 1, start: 0, duration: DUR, ease: linear });
  } else {
    const dir = move === "pan-left" ? -1 : 1;
    photoWrap.scale.set(1.12);
    timeline.to(photoWrap, { prop: "x", from: size.width / 2 - dir * size.width * 0.06, to: size.width / 2 + dir * size.width * 0.06, start: 0, duration: DUR, ease: linear });
  }

  // Scrim.
  const scrimH = size.height * 0.42;
  const scrim = new Sprite(verticalScrimTexture());
  scrim.tint = scrimColor;
  scrim.width = size.width;
  scrim.height = scrimH;
  scrim.position.set(0, size.height - scrimH);
  scrim.alpha = 0;
  root.addChild(scrim);
  timeline.to(scrim, { prop: "alpha", from: 0, to: scrimAmt, start: 0, duration: 0.6, ease: outQuad });

  // Caption block, above the platform-UI safe zone.
  const zone = safeZone(ctx.aspect);
  const baseY = size.height - Math.max(zone.bottom, scrimH * 0.4) - size.width * 0.02;
  const captionSize = Math.round(size.width * (ctx.aspect === "16:9" ? 0.05 : 0.062));
  const marginX = size.width * 0.07;

  if (showAccentBar) {
    const barW = size.width * 0.14;
    const bar = new Graphics().roundRect(0, 0, barW, Math.max(4, captionSize * 0.12), 3).fill(accent);
    bar.position.set(marginX, baseY - captionSize * 1.1);
    bar.scale.set(0, 1);
    root.addChild(bar);
    timeline.to(bar, { prop: "scale.x", from: 0, to: 1, start: 0.6, duration: 0.4, ease: outExpo });
  }

  const captionText = makeText(fonts, { text: caption, role: "display", weight: 700, size: captionSize, color: captionColor, anchor: { x: 0, y: 1 } });
  captionText.position.set(marginX, baseY);
  captionText.alpha = 0;
  root.addChild(captionText);
  timeline
    .to(captionText, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.5, ease: outQuad })
    .to(captionText, { prop: "y", from: baseY + 24, to: baseY, start: 0.6, duration: 0.6, ease: outQuint })
    .to(captionText, { prop: "y", from: baseY, to: baseY + 6, start: DUR - 0.6, duration: 0.6, ease: outQuad });

  if (handle.length > 0) {
    const handleText = makeText(fonts, { text: handle, role: "body", weight: 500, size: Math.round(captionSize * 0.42), color: captionColor, anchor: { x: 0, y: 1 } });
    handleText.position.set(marginX, baseY - captionSize * 1.4);
    handleText.alpha = 0;
    root.addChild(handleText);
    timeline.to(handleText, { prop: "alpha", from: 0, to: 0.7, start: 1.4, duration: 0.4, ease: outQuad });
  }

  return { timeline, duration: DUR };
}

export const kenBurns: TemplateDefinition = {
  id: "ken-burns",
  name: "Ken Burns Story",
  tagline: "A photo comes alive with a slow cinematic move.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.0,
  palettes: PALETTES,
  fields: [
    { key: "photo", type: "image", label: "Photo", default: "", optional: true, help: "Fills the frame; best with a landscape or portrait photo." },
    { key: "caption", type: "text", label: "Caption", default: "Golden hour in Lisbon", maxLength: 70 },
    { key: "handle", type: "text", label: "Handle", default: "@jimamotion", maxLength: 24, optional: true },
    { key: "move", type: "select", label: "Movement", default: "zoom-in", options: [{ value: "zoom-in", label: "Zoom in" }, { value: "zoom-out", label: "Zoom out" }, { value: "pan-left", label: "Pan ←" }, { value: "pan-right", label: "Pan →" }] },
    { key: "scrim", type: "slider", label: "Scrim", default: 0.55, min: 0, max: 1, step: 0.05 },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
