import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
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
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Shrink a single-line size so `text` fits `maxWidth`. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A "now playing" music HUD for the bottom-left corner — square album art, a
// track/artist stack, a progress bar that fills as `t` advances, and a tiny
// bouncing equalizer badge. Only the full-frame `bg` rect is tied to the
// background field (defaults to the transparent sentinel so it composites
// straight onto footage); the card uses its own palette-only `cardBg` so the
// readout stays legible once the canvas fill is gone. The eq bars and the
// play-icon placeholder are drawn in a fixed dark ink (contrast-checked
// against every `accent`), and the placeholder glyph reuses `textColor`
// (already checked against `imageBack`) rather than introducing new
// unverified color pairs.
const PALETTES: Palette[] = [
  { id: "carbon", name: "Carbon", colors: { cardBg: "#17171C", textColor: "#FFFFFF", accent: "#FF4D1C", imageBack: "#26262C" } },
  { id: "paper", name: "Paper", colors: { cardBg: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6", imageBack: "#E7ECF5" } },
  { id: "mint", name: "Mint", colors: { cardBg: "#FFFFFF", textColor: "#0B1F16", accent: "#17A34A", imageBack: "#DCF3E6" } },
  { id: "grape", name: "Grape", colors: { cardBg: "#1B1030", textColor: "#FFFFFF", accent: "#B08BFF", imageBack: "#2C1B4F" } },
];

const PROGRESS_TARGET = 0.62;
const ON_ACCENT = "#101014"; // fixed, contrast-checked against every accent above

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const cardBg = pc("cardBg", "#17171C");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const imageBack = str(values.imageBack, pc("imageBack", "#26262C"));
  const title = str(values.title, "Midnight Drive");
  const artist = str(values.artist, "The Night Owls");
  const showEq = values.showEq !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const albumSize = Math.round(minDim * 0.15);
  const padX = Math.round(minDim * 0.026);
  const padY = Math.round(minDim * 0.024);
  const gapAT = Math.round(minDim * 0.024);
  const albumRadius = Math.round(albumSize * 0.16);

  const titleSize0 = Math.round(minDim * 0.032);
  const artistSize0 = Math.round(titleSize0 * 0.6);
  const gapTitleArtist = Math.round(minDim * 0.006);
  const gapArtistBar = Math.round(minDim * 0.018);
  const trackH = Math.max(4, Math.round(minDim * 0.009));

  const maxTextW = Math.min(minDim * 0.56, w * 0.42);
  const titleFit = fitSize(fonts, title, "display", 700, titleSize0, maxTextW);
  const artistFit = artist.length > 0 ? fitSize(fonts, artist, "body", 500, artistSize0, maxTextW) : 0;

  const textContentH = titleFit + (artist.length > 0 ? gapTitleArtist + artistFit : 0) + gapArtistBar + trackH;
  const cardH = padY * 2 + Math.max(albumSize, textContentH);
  const cardW = padX * 2 + albumSize + gapAT + maxTextW;
  const cardRadius = Math.round(minDim * 0.02);

  const marginBottom = Math.round(minDim * 0.03);
  const cx = zone.left + cardW / 2;
  const cy = h - zone.bottom - marginBottom - cardH / 2;

  // --- Card surface ---
  const card = new Container();
  card.position.set(cx, cy);
  card.scale.set(0.92);
  card.alpha = 0;
  root.addChild(card);

  const e = Math.round(cardRadius * 0.3);
  const off = Math.round(cardRadius * 0.5);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardRadius + e)
      .fill({ color: "#000000", alpha: 0.2 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

  // --- Album art (image, or a placeholder + play glyph), rounded corners ---
  const albumX = -cardW / 2 + padX + albumSize / 2;
  const albumHolder = new Container();
  albumHolder.position.set(albumX, 0);
  albumHolder.scale.set(0.7);
  albumHolder.alpha = 0;
  card.addChild(albumHolder);

  const tex = images.image ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(albumSize / tex.width, albumSize / tex.height);
    s.scale.set(cover);
    const clip = new Graphics().roundRect(-albumSize / 2, -albumSize / 2, albumSize, albumSize, albumRadius).fill(0xffffff);
    albumHolder.addChild(s, clip);
    s.mask = clip;
  } else {
    albumHolder.addChild(new Graphics().roundRect(-albumSize / 2, -albumSize / 2, albumSize, albumSize, albumRadius).fill(imageBack));
    const placeholderIcon = makeIcon("play", albumSize * 0.34, { color: textColor });
    placeholderIcon.alpha = 0.55;
    albumHolder.addChild(placeholderIcon);
  }

  // --- EQ badge (toggleable): bottom-right corner of the album art ---
  let eqBars: Graphics[] | undefined;
  if (showEq) {
    const badgeR = Math.round(albumSize * 0.24);
    const badge = new Container();
    badge.position.set(albumSize / 2 - badgeR * 0.55, albumSize / 2 - badgeR * 0.55);
    badge.scale.set(0);
    albumHolder.addChild(badge);
    badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));

    const barW = Math.max(2, Math.round(badgeR * 0.16));
    const barGap = Math.round(badgeR * 0.16);
    const barMaxH = badgeR * 0.85;
    const bars: Graphics[] = [];
    for (const bx of [-(barW + barGap), 0, barW + barGap]) {
      const bar = new Graphics().roundRect(-barW / 2, -barMaxH, barW, barMaxH, barW / 2).fill(ON_ACCENT);
      bar.position.set(bx, barMaxH * 0.4);
      bar.scale.y = 0.4;
      badge.addChild(bar);
      bars.push(bar);
    }
    eqBars = bars;

    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.55, duration: 0.4, ease: spring(0.4) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.55, duration: 0.4, ease: spring(0.4) });
  }

  // --- Title / artist / progress track (text column, right of the art) ---
  const textX = -cardW / 2 + padX + albumSize + gapAT;
  const blockTop = -textContentH / 2;
  const titleY = blockTop + titleFit / 2;
  const artistY = titleY + titleFit / 2 + gapTitleArtist + artistFit / 2;
  const barY = (artist.length > 0 ? artistY + artistFit / 2 : titleY + titleFit / 2) + gapArtistBar + trackH / 2;

  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleFit, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(textX, titleY + 14);
  titleText.alpha = 0;
  card.addChild(titleText);

  if (artist.length > 0) {
    const artistText = makeText(fonts, { text: artist, role: "body", weight: 500, size: artistFit, color: textColor, anchor: { x: 0, y: 0.5 } });
    artistText.alpha = 0;
    artistText.position.set(textX, artistY + 14);
    card.addChild(artistText);
    timeline
      .to(artistText, { prop: "alpha", from: 0, to: 0.75, start: 0.48, duration: 0.4, ease: outQuad })
      .to(artistText, { prop: "y", from: artistY + 14, to: artistY, start: 0.48, duration: 0.5, ease: outQuint });
  }

  // --- Progress track + fill (fill fraction derives purely from t via update()) ---
  const trackW = maxTextW;
  const track = new Graphics().roundRect(0, -trackH / 2, trackW, trackH, trackH / 2).fill({ color: textColor, alpha: 0.18 });
  track.position.set(textX, barY);
  track.alpha = 0;
  card.addChild(track);

  const fill = new Graphics().roundRect(0, -trackH / 2, trackW, trackH, trackH / 2).fill(accent);
  fill.position.set(textX, barY);
  fill.scale.x = 0;
  card.addChild(fill);

  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.92, to: 1, start: 0.0, duration: 0.5, ease: outExpo })
    .to(card, { prop: "scale.y", from: 0.92, to: 1, start: 0.0, duration: 0.5, ease: outExpo })
    .to(albumHolder, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.35, ease: outQuad })
    .to(albumHolder, { prop: "scale.x", from: 0.7, to: 1, start: 0.12, duration: 0.5, ease: spring(0.45) })
    .to(albumHolder, { prop: "scale.y", from: 0.7, to: 1, start: 0.12, duration: 0.5, ease: spring(0.45) })
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.38, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 14, to: titleY, start: 0.38, duration: 0.5, ease: outQuint })
    .to(track, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.35, ease: outQuad });

  const PROGRESS_START = 0.75;
  const PROGRESS_DUR = 2.6;
  const EQ_START = 0.95;
  const update = (t: number): void => {
    const u = clamp01((t - PROGRESS_START) / PROGRESS_DUR);
    fill.scale.x = outQuad(u) * PROGRESS_TARGET;
    if (!eqBars) return;
    if (t < EQ_START) {
      for (const bar of eqBars) bar.scale.y = 0.4;
      return;
    }
    const tau = t - EQ_START;
    const phases = [0, 1.4, 2.6];
    eqBars.forEach((bar, i) => {
      bar.scale.y = 0.38 + 0.62 * Math.abs(Math.sin(tau * 3.6 + (phases[i] ?? 0)));
    });
  };

  return { timeline, duration: 4.5, update };
}

export const nowPlaying: TemplateDefinition = {
  id: "now-playing",
  name: "Now Playing",
  tagline: "A music HUD card with album art, a fill bar, and a bouncing equalizer.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { title: "display", artist: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Track title", default: "Midnight Drive", maxLength: 40, shrinkToFit: true },
    { key: "artist", type: "text", label: "Artist", default: "The Night Owls", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "image", type: "image", label: "Album art", default: "", optional: true, help: "Square image; shows a placeholder when empty." },
    { key: "showEq", type: "toggle", label: "Equalizer badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "imageBack", type: "color", label: "Image back", default: "", optional: true },
  ],
  build,
};
