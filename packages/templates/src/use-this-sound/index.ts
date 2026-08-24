import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

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

/** A little spinning vinyl disc; asymmetric glint + note make rotation read. */
function makeDisc(s: number, body: string, glint: string, labelColor: string, note: string): Container {
  const R = s / 2;
  const c = new Container();
  c.addChild(new Graphics().circle(0, 0, R).fill(body));
  c.addChild(new Graphics().circle(0, 0, R * 0.86).stroke({ color: glint, width: Math.max(1, R * 0.02), alpha: 0.32 }));
  c.addChild(new Graphics().circle(0, 0, R * 0.64).stroke({ color: glint, width: Math.max(1, R * 0.02), alpha: 0.32 }));
  c.addChild(new Graphics().arc(0, 0, R * 0.92, -0.72, -0.04).stroke({ color: glint, width: R * 0.07, cap: "round", alpha: 0.5 }));
  c.addChild(new Graphics().circle(0, 0, R * 0.34).fill(labelColor));
  const n = new Graphics();
  n.rect(R * 0.02, -R * 0.2, R * 0.045, R * 0.26).fill(note);
  n.circle(R * 0.04, R * 0.06, R * 0.085).fill(note);
  n.rect(R * 0.02, -R * 0.2, R * 0.15, R * 0.05).fill(note);
  c.addChild(n);
  c.addChild(new Graphics().circle(0, 0, R * 0.05).fill(body));
  return c;
}

// A TikTok-style "use this sound" attribution bar: a spinning disc, the track +
// artist, and a "Use this sound ▸" CTA. The disc rotation is a pure function of t
// via update(). Full-frame `bg` carries the background field; the bar carries a
// `barBg` role + shadow.
const PALETTES: Palette[] = [
  { id: "carbon", name: "Carbon", colors: { background: "#0B0B10", barBg: "#17171C", textColor: "#FFFFFF", accent: "#FF4D6D", discBody: "#26262C", glint: "#FFFFFF" } },
  { id: "paper", name: "Paper", colors: { background: "#F4F5F8", barBg: "#FFFFFF", textColor: "#101014", accent: "#FF2E5B", discBody: "#1A1A20", glint: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#17102E", barBg: "#241645", textColor: "#FFFFFF", accent: "#B08BFF", discBody: "#120A24", glint: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#EAF7EE", barBg: "#FFFFFF", textColor: "#08221A", accent: "#12B886", discBody: "#0B2018", glint: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0B0B10"));
  const barBg = pc("barBg", "#17171C");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D6D"));
  const discBody = pc("discBody", "#26262C");
  const glint = pc("glint", "#FFFFFF");
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const track = str(values.track, "Original sound");
  const artist = str(values.artist, "maya.creates");
  const cta = str(values.cta, "Use this sound");
  const showDisc = on(values.showDisc);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Bar geometry ---
  const barH = Math.round(minDim * 0.13);
  const barW = Math.min(safe.width * 0.94, minDim * 1.5);
  const barR = Math.round(barH * 0.28);
  const pad = Math.round(barH * 0.16);
  const discS = barH - pad * 2;
  const gap = Math.round(barH * 0.16);

  const ctaSize = fitSize(fonts, cta, "display", 700, Math.round(barH * 0.2), barW * 0.4);
  const ctaTextW = fonts.measure(cta, { family: fonts.family("display"), weight: 700, size: ctaSize });
  const triW = ctaSize * 0.6;
  const ctaW = ctaTextW + triW + ctaSize * 1.7;
  const ctaH = Math.round(barH * 0.56);

  const discBlockW = showDisc ? discS + gap : 0;
  const textX = -barW / 2 + pad + discBlockW;
  const textMaxW = barW / 2 - pad - ctaW - gap - textX;

  const trackSize = fitSize(fonts, track, "display", 700, Math.round(barH * 0.23), Math.max(40, textMaxW));
  const artistSize = fitSize(fonts, artist, "body", 500, Math.round(barH * 0.18), Math.max(40, textMaxW));

  const barCy = safe.y + safe.height - barH / 2 - Math.round(minDim * 0.03);
  const slideDist = barH + minDim * 0.08;

  const bar = new Container();
  bar.position.set(cx, barCy + slideDist);
  bar.alpha = 0;
  root.addChild(bar);

  const e = Math.round(barR * 0.4);
  const eo = Math.round(barR * 0.5);
  bar.addChild(new Graphics().roundRect(-barW / 2 - e, -barH / 2 - e + eo, barW + e * 2, barH + e * 2, barR + e).fill({ color: "#000000", alpha: 0.2 }));
  bar.addChild(new Graphics().roundRect(-barW / 2, -barH / 2, barW, barH, barR).fill(barBg));

  // --- Disc ---
  let disc: Container | null = null;
  if (showDisc) {
    disc = makeDisc(discS, discBody, glint, accent, onAccent);
    disc.position.set(-barW / 2 + pad + discS / 2, 0);
    bar.addChild(disc);
  }

  // --- Track / artist ---
  const hasArtist = artist.length > 0;
  const trackY = hasArtist ? -barH * 0.15 : 0;
  const trackText = makeText(fonts, { text: track, role: "display", weight: 700, size: trackSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  trackText.position.set(textX, trackY);
  bar.addChild(trackText);
  if (hasArtist) {
    const artistText = makeText(fonts, { text: artist, role: "body", weight: 500, size: artistSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    artistText.alpha = 0.7;
    artistText.position.set(textX, barH * 0.19);
    bar.addChild(artistText);
  }

  // --- CTA pill ("Use this sound ▸") ---
  const ctaPill = new Container();
  ctaPill.position.set(barW / 2 - pad - ctaW / 2, 0);
  ctaPill.addChild(new Graphics().roundRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH, ctaH / 2).fill(accent));
  const ctaText = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: { x: 0, y: 0.5 } });
  ctaText.position.set(-ctaW / 2 + ctaSize * 0.7, 0);
  ctaPill.addChild(ctaText);
  const tri = new Graphics().poly([-triW * 0.4, -triW * 0.5, triW * 0.5, 0, -triW * 0.4, triW * 0.5]).fill(onAccent);
  tri.position.set(-ctaW / 2 + ctaSize * 0.7 + ctaTextW + triW * 0.6, 0);
  ctaPill.addChild(tri);
  bar.addChild(ctaPill);

  timeline
    .to(bar, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.3, ease: outQuad })
    .to(bar, { prop: "y", from: barCy + slideDist, to: barCy, start: 0.35, duration: 0.7, ease: outExpo });

  // CTA pulse.
  const pStart = 1.3;
  for (let i = 0; i < 3; i++) {
    const s0 = pStart + i * 0.95;
    timeline
      .to(ctaPill, { prop: "scale.x", from: 1, to: 1.06, start: s0, duration: 0.28, ease: outQuad })
      .to(ctaPill, { prop: "scale.y", from: 1, to: 1.06, start: s0, duration: 0.28, ease: outQuad })
      .to(ctaPill, { prop: "scale.x", from: 1.06, to: 1, start: s0 + 0.28, duration: 0.42, ease: spring(0.5) })
      .to(ctaPill, { prop: "scale.y", from: 1.06, to: 1, start: s0 + 0.28, duration: 0.42, ease: spring(0.5) });
  }

  const capturedDisc = disc;
  const update = capturedDisc
    ? (t: number): void => {
        capturedDisc.rotation = t * 1.8;
      }
    : undefined;

  const duration = 4.6;
  return update ? { timeline, duration, update } : { timeline, duration };
}

export const useThisSound: TemplateDefinition = {
  id: "use-this-sound",
  name: "Use This Sound",
  tagline: "A spinning disc, the track and artist, and a Use this sound CTA slide in.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { track: "display", artist: "body", cta: "display" },
  palettes: PALETTES,
  fields: [
    { key: "track", type: "text", label: "Track", default: "Original sound", maxLength: 32, shrinkToFit: true },
    { key: "artist", type: "text", label: "Artist", default: "maya.creates", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "cta", type: "text", label: "CTA", default: "Use this sound", maxLength: 18, shrinkToFit: true },
    { key: "showDisc", type: "toggle", label: "Spinning disc", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
