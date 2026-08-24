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

// Book Cover — the book stands up out of the frame, its spine catching a
// lighter edge, and the cover opens a few degrees so you see it as an object
// with thickness. For a zine, a report, a menu, a self-published anything.
//
// The "opening" is a narrow parallelogram behind the cover standing in for the
// pages — the same trick a photographer uses, and enough to sell depth at the
// size a phone shows.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "press", name: "Press", colors: { background: "#EEECE6", textColor: "#14151A", accent: "#B4472B" } },
  { id: "ink", name: "Ink", colors: { background: "#101116", textColor: "#F4F4F1", accent: "#D8C48A" } },
  { id: "sea", name: "Sea", colors: { background: "#E9F1F3", textColor: "#0E1E24", accent: "#0E7490" } },
  { id: "moss", name: "Moss", colors: { background: "#EDF2EA", textColor: "#131C13", accent: "#5C6B2F" } },
];

interface Layout {
  bookFrac: number;
  titleFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { bookFrac: 0.22, titleFrac: 0.04, centerFrac: 0.44 };
    case "9:16":
      return { bookFrac: 0.44, titleFrac: 0.052, centerFrac: 0.42 };
    case "4:5":
      return { bookFrac: 0.4, titleFrac: 0.048, centerFrac: 0.43 };
    case "1:1":
    default:
      return { bookFrac: 0.38, titleFrac: 0.046, centerFrac: 0.43 };
  }
}

const STAND_AT = 0.3;
const OPEN_AT = 1.1;
const DURATION = 5.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEECE6"));
  const textColor = str(values.textColor, pc("textColor", "#14151A"));
  const accent = str(values.accent, pc("accent", "#B4472B"));
  const coverTitle = str(values.coverTitle, "Field Notes");
  const author = str(values.author, "M. Vidal");
  const caption = str(values.caption, "").trim();
  const showShadow = on(values.showShadow);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const W = Math.min(size.width * L.bookFrac, size.height * 0.28);
  const H = W * 1.42;
  const spine = W * 0.13;
  const titleSize = Math.round(size.width * L.titleFrac);

  const timeline = new JimaTimeline();
  const book = new Container();
  book.position.set(cx, cy);
  root.addChild(book);

  if (showShadow) {
    for (let i = 7; i >= 1; i--) {
      const f = i / 7;
      book.addChild(
        new Graphics()
          .ellipse(spine * 0.4, H * 0.54, W * (0.52 + 0.07 * f), H * (0.035 + 0.012 * f))
          .fill({ color: "#000000", alpha: 0.05 }),
      );
    }
  }

  // --- Pages: a sliver behind the cover, opening a few degrees ---
  const pages = new Container();
  book.addChild(pages);
  pages.addChild(
    new Graphics()
      .poly([W / 2, -H / 2, W / 2 + spine, -H / 2 + spine * 0.5, W / 2 + spine, H / 2 + spine * 0.5, W / 2, H / 2])
      .fill("#FAF8F3"),
  );
  // Page edges, so the block is not a flat slab.
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    pages.addChild(
      new Graphics()
        .poly([W / 2 + spine * t, -H / 2 + spine * 0.5 * t, W / 2 + spine * t, H / 2 + spine * 0.5 * t], false)
        .stroke({ color: "#000000", width: Math.max(1, W * 0.002), alpha: 0.07 }),
    );
  }

  // --- Cover ---
  const cover = new Container();
  book.addChild(cover);
  cover.addChild(new Graphics().rect(-W / 2, -H / 2, W, H).fill(accent));
  // The spine hinge: a slightly darker strip on the left of the cover.
  cover.addChild(new Graphics().rect(-W / 2, -H / 2, W * 0.055, H).fill({ color: "#000000", alpha: 0.18 }));

  const tex = isImageRef(values.cover) ? images.cover : null;
  if (tex) {
    const sp = new Sprite(tex);
    const sc = Math.max(W / sp.texture.width, H / sp.texture.height);
    sp.scale.set(sc);
    sp.anchor.set(0.5);
    const clip = new Graphics().rect(-W / 2, -H / 2, W, H).fill("#FFFFFF");
    cover.addChild(sp, clip);
    sp.mask = clip;
  } else {
    const t = makeText(fonts, {
      text: coverTitle,
      role: "serif",
      weight: 600,
      size: W * 0.15,
      color: bg,
      anchor: 0.5,
      align: "center",
    });
    if (t.width > W * 0.76) t.scale.set((W * 0.76) / t.width);
    t.y = -H * 0.12;
    cover.addChild(t);
    cover.addChild(new Graphics().rect(-W * 0.16, H * 0.02, W * 0.32, Math.max(2, W * 0.008)).fill({ color: bg, alpha: 0.7 }));
    const a = makeText(fonts, { text: author, role: "body", weight: 600, size: W * 0.07, color: bg, anchor: 0.5 });
    a.alpha = 0.85;
    a.y = H * 0.14;
    cover.addChild(a);
  }

  // The cover swings open a few degrees about its spine, which is at its left
  // edge — so the pivot has to move there, not stay at the centre.
  cover.pivot.set(-W / 2, 0);
  cover.position.set(-W / 2, 0);
  timeline.to(cover, { prop: "scale.x", from: 1, to: 0.93, start: OPEN_AT, duration: 0.9, ease: outExpo });

  book.alpha = 0;
  timeline
    .to(book, { prop: "alpha", from: 0, to: 1, start: STAND_AT, duration: 0.4, ease: outQuad })
    // Stands up: it starts squashed on y and rises to full height.
    .to(book, { prop: "scale.y", from: 0.82, to: 1, start: STAND_AT, duration: 1.0, ease: outExpo })
    .to(book, { prop: "y", from: cy + H * 0.1, to: cy, start: STAND_AT, duration: 1.0, ease: outExpo })
    .to(book, { prop: "rotation", from: 0.04, to: 0, start: STAND_AT, duration: 1.2, ease: outExpo });

  // --- Type below ---
  const titleY = cy + H * 0.62 + titleSize * 0.5;
  const t = makeText(fonts, { text: coverTitle, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  const maxW = size.width * 0.86;
  if (t.width > maxW) t.scale.set(maxW / t.width);
  t.position.set(cx, titleY);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: OPEN_AT + 0.15, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: titleY + titleSize * 0.3, to: titleY, start: OPEN_AT + 0.15, duration: 0.8, ease: outExpo });

  if (caption.length > 0) {
    const c = makeText(fonts, { text: caption, role: "body", weight: 600, size: titleSize * 0.5, color: textColor, anchor: 0.5 });
    const cyy = titleY + titleSize * 0.85;
    c.alpha = 0;
    c.position.set(cx, cyy);
    root.addChild(c);
    timeline
      .to(c, { prop: "alpha", from: 0, to: 0.66, start: OPEN_AT + 0.4, duration: 0.5, ease: outQuad })
      .to(c, { prop: "y", from: cyy + titleSize * 0.18, to: cyy, start: OPEN_AT + 0.4, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const bookMockup: TemplateDefinition = {
  id: "book-mockup",
  name: "Book Cover",
  tagline: "The book stands up, its page block catching the light, and the cover eases open.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { coverTitle: "serif", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "cover", type: "image", label: "Cover artwork", default: null, optional: true },
    { key: "coverTitle", type: "text", label: "Title", default: "Field Notes", maxLength: 30, shrinkToFit: true },
    { key: "author", type: "text", label: "Author", default: "M. Vidal", maxLength: 26 },
    { key: "caption", type: "text", label: "Caption", default: "96 pages · risograph · out now", maxLength: 46, optional: true },
    { key: "showShadow", type: "toggle", label: "Contact shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Cover", default: "", optional: true },
  ],
  build,
};
