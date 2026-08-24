import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  isImageRef,
  makeText,
  outBack,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

// Music Player — a full-frame now-playing card: artwork, track, artist, a
// scrubber that actually advances, and a level meter under the controls. For
// posting a release, a playlist, or "the song I made this to".
//
// `now-playing` is a small corner overlay. This is the screen itself, so the
// artwork slot is the point and the progress bar is real rather than decorative.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "night", name: "Night", colors: { background: "#121317", textColor: "#F4F4F6", accent: "#1DB954" } },
  { id: "sunset", name: "Sunset", colors: { background: "#1B1114", textColor: "#FBF0EE", accent: "#FB7185" } },
  { id: "indigo", name: "Indigo", colors: { background: "#101228", textColor: "#EFEFFA", accent: "#818CF8" } },
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#15161A", accent: "#111318" } },
];

interface Layout {
  artFrac: number;
  titleFrac: number;
  topFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { artFrac: 0.3, titleFrac: 0.042, topFrac: 0.12 };
    case "9:16":
      return { artFrac: 0.72, titleFrac: 0.056, topFrac: 0.14 };
    case "4:5":
      return { artFrac: 0.62, titleFrac: 0.05, topFrac: 0.11 };
    case "1:1":
    default:
      return { artFrac: 0.5, titleFrac: 0.046, topFrac: 0.1 };
  }
}

const IN_AT = 0.25;
const PLAY_AT = 0.9;
const DURATION = 5.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#121317"));
  const textColor = str(values.textColor, pc("textColor", "#F4F4F6"));
  const accent = str(values.accent, pc("accent", "#1DB954"));
  const track = str(values.track, "Night Bus");
  const artist = str(values.artist, "Fika Sound");
  const elapsed = str(values.elapsed, "1:12");
  const total = str(values.total, "3:04");
  const showMeter = on(values.showMeter);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const art = Math.min(size.width * L.artFrac, size.height * 0.46);
  const artTop = size.height * L.topFrac + art * 0.1;
  const titleSize = Math.round(size.width * L.titleFrac);

  const timeline = new JimaTimeline();

  // --- Artwork ---
  const artHolder = new Container();
  artHolder.position.set(cx, artTop + art / 2);
  root.addChild(artHolder);
  const radius = art * 0.06;
  const tex = isImageRef(values.artwork) ? images.artwork : null;
  if (tex) {
    const sp = new Sprite(tex);
    const scale = Math.max(art / sp.texture.width, art / sp.texture.height);
    sp.scale.set(scale);
    sp.anchor.set(0.5);
    const clip = new Graphics().roundRect(-art / 2, -art / 2, art, art, radius).fill("#FFFFFF");
    artHolder.addChild(sp, clip);
    sp.mask = clip;
  } else {
    // A placeholder that still looks like cover art: accent field with a disc.
    artHolder.addChild(new Graphics().roundRect(-art / 2, -art / 2, art, art, radius).fill(accent));
    artHolder.addChild(new Graphics().circle(0, 0, art * 0.26).fill({ color: bg, alpha: 0.55 }));
    artHolder.addChild(new Graphics().circle(0, 0, art * 0.06).fill(accent));
  }
  artHolder.alpha = 0;
  timeline
    .to(artHolder, { prop: "alpha", from: 0, to: 1, start: IN_AT, duration: 0.45, ease: outQuad })
    .to(artHolder, { prop: "scale.x", from: 0.88, to: 1, start: IN_AT, duration: 0.8, ease: outExpo })
    .to(artHolder, { prop: "scale.y", from: 0.88, to: 1, start: IN_AT, duration: 0.8, ease: outExpo });

  // --- Track & artist ---
  const textTop = artTop + art + titleSize * 1.1;
  const t = makeText(fonts, {
    text: track,
    role: "display",
    weight: 800,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
  });
  const maxW = size.width * 0.84;
  if (t.width > maxW) t.scale.set(maxW / t.width);
  t.position.set(cx, textTop);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: IN_AT + 0.25, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: textTop + titleSize * 0.35, to: textTop, start: IN_AT + 0.25, duration: 0.75, ease: outExpo });

  const a = makeText(fonts, {
    text: artist,
    role: "body",
    weight: 500,
    size: Math.round(titleSize * 0.56),
    color: textColor,
    anchor: 0.5,
  });
  a.alpha = 0;
  const ay = textTop + titleSize * 0.85;
  a.position.set(cx, ay);
  root.addChild(a);
  timeline
    .to(a, { prop: "alpha", from: 0, to: 0.66, start: IN_AT + 0.4, duration: 0.45, ease: outQuad })
    .to(a, { prop: "y", from: ay + titleSize * 0.2, to: ay, start: IN_AT + 0.4, duration: 0.75, ease: outQuint });

  // --- Scrubber ---
  const barW = size.width * 0.76;
  const barY = ay + titleSize * 1.2;
  const barH = Math.max(4, size.width * 0.006);
  root.addChild(
    new Graphics().roundRect(cx - barW / 2, barY, barW, barH, barH / 2).fill({ color: textColor, alpha: 0.2 }),
  );
  const fill = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(accent);
  fill.position.set(cx - barW / 2, barY);
  fill.scale.x = 0;
  root.addChild(fill);

  const knob = new Graphics().circle(0, 0, barH * 1.7).fill(textColor);
  knob.position.set(cx - barW / 2, barY + barH / 2);
  knob.scale.set(0);
  root.addChild(knob);
  timeline
    .to(knob, { prop: "scale.x", from: 0, to: 1, start: PLAY_AT, duration: 0.4, ease: outBack })
    .to(knob, { prop: "scale.y", from: 0, to: 1, start: PLAY_AT, duration: 0.4, ease: outBack });

  const timeSize = Math.round(titleSize * 0.36);
  const el = makeText(fonts, { text: elapsed, role: "body", weight: 600, size: timeSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  const to = makeText(fonts, { text: total, role: "body", weight: 600, size: timeSize, color: textColor, anchor: { x: 1, y: 0.5 } });
  el.alpha = 0.5;
  to.alpha = 0.5;
  el.position.set(cx - barW / 2, barY + barH + timeSize * 1.1);
  to.position.set(cx + barW / 2, barY + barH + timeSize * 1.1);
  root.addChild(el, to);

  // --- Transport controls ---
  const ctrlY = barY + timeSize * 3.4;
  const ctrl = new Container();
  ctrl.position.set(cx, ctrlY);
  root.addChild(ctrl);
  const playR = titleSize * 0.85;
  ctrl.addChild(new Graphics().circle(0, 0, playR).fill(accent));
  const playIcon = makeIcon("play", playR * 0.95, { color: bg });
  playIcon.x = playR * 0.06;
  ctrl.addChild(playIcon);
  for (const s of [-1, 1]) {
    const tri = new Graphics()
      .poly([0, -playR * 0.42, playR * 0.42 * s, 0, 0, playR * 0.42])
      .poly([playR * 0.42 * s, -playR * 0.42, playR * 0.84 * s, 0, playR * 0.42 * s, playR * 0.42])
      .fill({ color: textColor, alpha: 0.75 });
    tri.position.set(s * playR * 2.3, 0);
    ctrl.addChild(tri);
  }
  ctrl.scale.set(0);
  timeline
    .to(ctrl, { prop: "scale.x", from: 0, to: 1, start: PLAY_AT - 0.15, duration: 0.55, ease: outBack })
    .to(ctrl, { prop: "scale.y", from: 0, to: 1, start: PLAY_AT - 0.15, duration: 0.55, ease: outBack });

  // --- Level meter under the controls ---
  const meters: Graphics[] = [];
  const phases: number[] = [];
  if (showMeter) {
    const count = 24;
    const span = size.width * 0.5;
    const gap = span / count;
    const w = gap * 0.5;
    const my = ctrlY + playR * 2.1;
    for (let i = 0; i < count; i++) {
      const g = new Graphics().roundRect(-w / 2, -0.5, w, 1, w / 2).fill(accent);
      g.position.set(cx - span / 2 + gap * (i + 0.5), my);
      g.alpha = 0.75;
      root.addChild(g);
      meters.push(g);
      phases.push(rng.range(0, Math.PI * 2));
    }
  }

  const update = (time: number): void => {
    const u = Math.max(0, Math.min(1, (time - PLAY_AT) / (DURATION - PLAY_AT - 0.4)));
    fill.scale.x = u;
    knob.x = cx - barW / 2 + barW * u;
    const ramp = Math.max(0, Math.min(1, (time - PLAY_AT) / 0.5));
    for (let i = 0; i < meters.length; i++) {
      const p = phases[i]!;
      const v = 0.5 + 0.3 * Math.sin(time * 5.4 + p) + 0.2 * Math.sin(time * 2.1 + p * 1.7);
      meters[i]!.height = Math.max(2, titleSize * 0.5 * Math.max(0.08, Math.min(1, v)) * ramp);
    }
  };
  update(0);

  return { timeline, duration: DURATION, update };
}

export const musicPlayer: TemplateDefinition = {
  id: "music-player",
  name: "Music Player",
  tagline: "A full-screen now-playing card — artwork, scrubber that actually moves, and levels.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { track: "display", artist: "body" },
  palettes: PALETTES,
  fields: [
    { key: "artwork", type: "image", label: "Artwork", default: null, optional: true },
    { key: "track", type: "text", label: "Track", default: "Night Bus", maxLength: 34, shrinkToFit: true },
    { key: "artist", type: "text", label: "Artist", default: "Fika Sound", maxLength: 34 },
    { key: "elapsed", type: "text", label: "Elapsed", default: "1:12", maxLength: 8 },
    { key: "total", type: "text", label: "Length", default: "3:04", maxLength: 8 },
    { key: "showMeter", type: "toggle", label: "Level meter", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
