import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  isImageRef,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Vinyl Sleeve — the record slides out of its sleeve, spinning, and stops with
// the label facing you. The release-day post for anyone who makes music, and
// the first physical-object mockup in the library.
//
// The disc keeps turning for the whole clip (a record that stops spinning is a
// still), and the sleeve tilts a few degrees as the weight leaves it.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "night", name: "Night", colors: { background: "#121317", textColor: "#F4F4F6", accent: "#E4B33C" } },
  { id: "riso", name: "Riso", colors: { background: "#F7F2E7", textColor: "#191712", accent: "#E2523B" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#0D1426", textColor: "#EDF1FA", accent: "#5A8DEE" } },
  { id: "moss", name: "Moss", colors: { background: "#101A14", textColor: "#EBF5EE", accent: "#7FC99A" } },
];

interface Layout {
  sleeveFrac: number;
  titleFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { sleeveFrac: 0.3, titleFrac: 0.042, centerFrac: 0.44 };
    case "9:16":
      return { sleeveFrac: 0.56, titleFrac: 0.056, centerFrac: 0.42 };
    case "4:5":
      return { sleeveFrac: 0.5, titleFrac: 0.05, centerFrac: 0.43 };
    case "1:1":
    default:
      return { sleeveFrac: 0.46, titleFrac: 0.048, centerFrac: 0.43 };
  }
}

const SLIDE_AT = 0.45;
const SLIDE_DUR = 1.35;
const DURATION = 5.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#121317"));
  const textColor = str(values.textColor, pc("textColor", "#F4F4F6"));
  const accent = str(values.accent, pc("accent", "#E4B33C"));
  const title = str(values.title, "Night Bus");
  const artist = str(values.artist, "Fika Sound");
  const meta = str(values.meta, "").trim();
  const showShadow = on(values.showShadow);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const S = Math.min(size.width * L.sleeveFrac, size.height * 0.4);
  const cy = size.height * L.centerFrac;
  const titleSize = Math.round(size.width * L.titleFrac);

  const timeline = new JimaTimeline();
  const stage = new Container();
  stage.position.set(cx - S * 0.18, cy);
  root.addChild(stage);

  // --- The disc, behind the sleeve, sliding out to the right ---
  const disc = new Container();
  const R = S * 0.47;
  disc.addChild(new Graphics().circle(0, 0, R).fill("#141416"));
  // Grooves: concentric rings at low alpha, which is what reads as vinyl.
  for (let i = 0; i < 16; i++) {
    const rr = R * (0.42 + (i / 16) * 0.54);
    disc.addChild(
      new Graphics().circle(0, 0, rr).stroke({ color: "#FFFFFF", width: Math.max(1, R * 0.004), alpha: 0.05 }),
    );
  }
  disc.addChild(new Graphics().circle(0, 0, R * 0.34).fill(accent));
  disc.addChild(new Graphics().circle(0, 0, R * 0.035).fill(bg));
  // A highlight sweep across the disc, so it reads as glossy under a light.
  const gloss = new Graphics()
    .poly([-R * 0.16, -R, R * 0.16, -R, R * 0.5, R, R * 0.18, R])
    .fill({ color: "#FFFFFF", alpha: 0.07 });
  const glossClip = new Graphics().circle(0, 0, R).fill("#FFFFFF");
  disc.addChild(gloss, glossClip);
  gloss.mask = glossClip;

  stage.addChild(disc);
  disc.position.set(0, 0);
  timeline.to(disc, { prop: "x", from: 0, to: S * 0.62, start: SLIDE_AT, duration: SLIDE_DUR, ease: outExpo });

  // --- The sleeve ---
  const sleeve = new Container();
  stage.addChild(sleeve);
  if (showShadow) {
    for (let i = 6; i >= 1; i--) {
      const f = i / 6;
      sleeve.addChild(
        new Graphics()
          .roundRect(-S / 2 - S * 0.02 * f, -S / 2 + S * 0.03, S + S * 0.04 * f, S, S * 0.012)
          .fill({ color: "#000000", alpha: 0.05 }),
      );
    }
  }
  const tex = isImageRef(values.cover) ? images.cover : null;
  if (tex) {
    const sp = new Sprite(tex);
    const sc = Math.max(S / sp.texture.width, S / sp.texture.height);
    sp.scale.set(sc);
    sp.anchor.set(0.5);
    const clip = new Graphics().rect(-S / 2, -S / 2, S, S).fill("#FFFFFF");
    sleeve.addChild(sp, clip);
    sp.mask = clip;
  } else {
    sleeve.addChild(new Graphics().rect(-S / 2, -S / 2, S, S).fill(accent));
    // A simple sleeve graphic so the placeholder still looks designed.
    sleeve.addChild(
      new Graphics()
        .circle(0, 0, S * 0.26)
        .stroke({ color: bg, width: Math.max(3, S * 0.012), alpha: 0.55 }),
    );
    const cover = makeText(fonts, {
      text: title,
      role: "display",
      weight: 800,
      size: S * 0.11,
      color: bg,
      anchor: 0.5,
      align: "center",
    });
    if (cover.width > S * 0.8) cover.scale.set((S * 0.8) / cover.width);
    cover.y = S * 0.3;
    sleeve.addChild(cover);
  }
  // The open edge, drawn as a darker lip on the right where the disc leaves.
  sleeve.addChild(
    new Graphics().rect(S / 2 - S * 0.012, -S / 2, S * 0.012, S).fill({ color: "#000000", alpha: 0.25 }),
  );

  // The sleeve tips a little as the record's weight leaves it.
  timeline
    .to(sleeve, { prop: "rotation", from: 0, to: -0.035, start: SLIDE_AT, duration: SLIDE_DUR * 0.6, ease: outQuad })
    .to(sleeve, { prop: "rotation", from: -0.035, to: -0.012, start: SLIDE_AT + SLIDE_DUR * 0.6, duration: 0.8, ease: outExpo });

  stage.alpha = 0;
  timeline
    .to(stage, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.4, ease: outQuad })
    .to(stage, { prop: "y", from: cy + S * 0.1, to: cy, start: 0.2, duration: 0.85, ease: outExpo });

  // --- Type below ---
  const titleY = cy + S * 0.62 + titleSize * 0.6;
  const t = makeText(fonts, { text: title, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  const maxW = size.width * 0.86;
  if (t.width > maxW) t.scale.set(maxW / t.width);
  t.position.set(cx, titleY);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: SLIDE_AT + 0.5, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: titleY + titleSize * 0.35, to: titleY, start: SLIDE_AT + 0.5, duration: 0.8, ease: outExpo });

  const aY = titleY + titleSize * 0.85;
  const a = makeText(fonts, { text: artist, role: "body", weight: 600, size: titleSize * 0.52, color: accent, anchor: 0.5 });
  a.alpha = 0;
  a.position.set(cx, aY);
  root.addChild(a);
  timeline
    .to(a, { prop: "alpha", from: 0, to: 1, start: SLIDE_AT + 0.68, duration: 0.45, ease: outQuad })
    .to(a, { prop: "y", from: aY + titleSize * 0.2, to: aY, start: SLIDE_AT + 0.68, duration: 0.8, ease: outQuint });

  if (meta.length > 0) {
    const m = makeText(fonts, {
      text: meta.toUpperCase(),
      role: "body",
      weight: 700,
      size: titleSize * 0.32,
      color: textColor,
      anchor: 0.5,
      letterSpacing: titleSize * 0.05,
    });
    const my = aY + titleSize * 0.7;
    m.alpha = 0;
    m.position.set(cx, my);
    root.addChild(m);
    timeline.to(m, { prop: "alpha", from: 0, to: 0.5, start: SLIDE_AT + 0.9, duration: 0.5, ease: outQuad });
  }

  // A record turns. Driven from `update` so it keeps going past the slide.
  const update = (time: number): void => {
    const spinFrom = Math.max(0, time - SLIDE_AT * 0.6);
    disc.rotation = spinFrom * 2.1;
  };
  update(0);

  return { timeline, duration: DURATION, update };
}

export const vinylSleeve: TemplateDefinition = {
  id: "vinyl-sleeve",
  name: "Vinyl Sleeve",
  tagline: "The record slides out of its sleeve, still turning, and the credits land beneath.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display", artist: "body" },
  palettes: PALETTES,
  fields: [
    { key: "cover", type: "image", label: "Sleeve artwork", default: null, optional: true },
    { key: "title", type: "text", label: "Title", default: "Night Bus", maxLength: 30, shrinkToFit: true },
    { key: "artist", type: "text", label: "Artist", default: "Fika Sound", maxLength: 30 },
    { key: "meta", type: "text", label: "Meta line", default: "LP · out 14 March", maxLength: 34, optional: true },
    { key: "showShadow", type: "toggle", label: "Drop shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Label & sleeve", default: "", optional: true },
  ],
  build,
};
