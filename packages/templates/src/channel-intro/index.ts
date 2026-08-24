import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  makeOutBack,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { avatar } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#0A0A1E", textColor: "#FFFFFF", accent: "#2E7DF6" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF" } },
];

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#101014"));
  const textColor = str(values.textColor, pcol("textColor", "#FFFFFF"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const channel = str(values.channel, "@yourchannel");
  const tagline = str(values.tagline, "");
  const showRing = values.showRing !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const availW = w * 0.86;

  const zone = safeZone(ctx.aspect);
  const safeH = h - zone.top - zone.bottom;
  const logoCy = zone.top + safeH * 0.38;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const logoR = minDim * 0.15;

  // --- Ring sweep (a dozen ticks light up around the logo) ---
  if (showRing) {
    const ringR = logoR * 1.34;
    const tickCount = 12;
    const tickLen = logoR * 0.22;
    const tickThick = Math.max(3, logoR * 0.09);
    const ticks: Graphics[] = [];
    for (let i = 0; i < tickCount; i++) {
      const angle = -Math.PI / 2 + (i * (Math.PI * 2)) / tickCount;
      const g = new Graphics().roundRect(-tickThick / 2, -tickLen / 2, tickThick, tickLen, tickThick / 2).fill(accent);
      g.position.set(cx + Math.cos(angle) * ringR, logoCy + Math.sin(angle) * ringR);
      g.rotation = angle + Math.PI / 2;
      g.alpha = 0;
      g.scale.set(0.3);
      root.addChild(g);
      ticks.push(g);
    }
    const sweepStart = 0.85;
    const each = 0.045;
    timeline
      .stagger(ticks, { prop: "alpha", from: 0, to: 1, start: sweepStart, duration: 0.16, ease: outQuad }, { each, start: sweepStart })
      .stagger(ticks, { prop: "scale.x", from: 0.3, to: 1, start: sweepStart, duration: 0.22, ease: makeOutBack(2) }, { each, start: sweepStart })
      .stagger(ticks, { prop: "scale.y", from: 0.3, to: 1, start: sweepStart, duration: 0.22, ease: makeOutBack(2) }, { each, start: sweepStart });
  }

  // --- Logo circle (monogram) ---
  const handle = channel.replace(/^@+/, "").trim();
  const initial = (handle.charAt(0) || "J").toUpperCase();
  const logoHolder = new Container();
  logoHolder.position.set(cx, logoCy);
  logoHolder.scale.set(0);
  logoHolder.addChild(avatar(fonts, { radius: logoR, bg: accent, initial, textColor: "#FFFFFF" }));
  root.addChild(logoHolder);
  timeline
    .to(logoHolder, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.65, ease: spring(0.42) })
    .to(logoHolder, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.65, ease: spring(0.42) })
    // A gentle idle float once everything has landed.
    .to(logoHolder, { prop: "y", from: logoCy, to: logoCy - minDim * 0.008, start: 1.6, duration: 1.1, ease: outQuad })
    .to(logoHolder, { prop: "y", from: logoCy - minDim * 0.008, to: logoCy + minDim * 0.008, start: 2.7, duration: 1.1, ease: outQuad });

  // --- Channel handle ---
  const handleY = logoCy + logoR * 1.9;
  const handleSizeRaw = Math.round(minDim * 0.062);
  const handleSize = fitSize(fonts, channel, "display", 700, handleSizeRaw, availW);
  const handleText = makeText(fonts, { text: channel, role: "display", weight: 700, size: handleSize, color: textColor, anchor: 0.5, align: "center" });
  handleText.position.set(cx, handleY + 22);
  handleText.alpha = 0;
  root.addChild(handleText);
  const handleStart = 1.7;
  timeline
    .to(handleText, { prop: "alpha", from: 0, to: 1, start: handleStart, duration: 0.4, ease: outQuad })
    .to(handleText, { prop: "y", from: handleY + 22, to: handleY, start: handleStart, duration: 0.55, ease: outExpo });

  // --- Tagline (optional) ---
  if (tagline.length > 0) {
    const tagSizeRaw = Math.round(minDim * 0.032);
    const tagSize = fitSize(fonts, tagline, "body", 500, tagSizeRaw, availW);
    const tagY = handleY + handleSize * 1.5;
    const tagText = makeText(fonts, { text: tagline, role: "body", weight: 500, size: tagSize, color: textColor, anchor: 0.5, align: "center" });
    tagText.position.set(cx, tagY + 16);
    tagText.alpha = 0;
    root.addChild(tagText);
    const tagStart = handleStart + 0.15;
    timeline
      .to(tagText, { prop: "alpha", from: 0, to: 0.88, start: tagStart, duration: 0.4, ease: outQuad })
      .to(tagText, { prop: "y", from: tagY + 16, to: tagY, start: tagStart, duration: 0.5, ease: outQuint });
  }

  return { timeline, duration: 4.0 };
}

export const channelIntro: TemplateDefinition = {
  id: "channel-intro",
  name: "Channel Intro",
  tagline: "A YouTube-style opener — logo, handle, tagline and a ring sweep.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { channel: "display", tagline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "channel", type: "text", label: "Channel", default: "@yourchannel", maxLength: 24 },
    { key: "tagline", type: "text", label: "Tagline", default: "new videos every week", maxLength: 48, optional: true },
    { key: "showRing", type: "toggle", label: "Accent ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
