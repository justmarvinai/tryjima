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

// Billboard — your work on an out-of-home board, on its posts, against a sky,
// with a small figure at the base for scale. Nothing sells a campaign like
// seeing it big, and scale is the entire trick: without the figure a billboard
// mockup is just a rectangle.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "day", name: "Day", colors: { background: "#DCE7F0", textColor: "#12181F", accent: "#E0483C" } },
  { id: "dusk", name: "Dusk", colors: { background: "#2A2438", textColor: "#F2EEF8", accent: "#F2B33D" } },
  { id: "night", name: "Night", colors: { background: "#111726", textColor: "#EDF1FA", accent: "#5AA9FF" } },
  { id: "paper", name: "Paper", colors: { background: "#F1EFE9", textColor: "#15161A", accent: "#2F7D5B" } },
];

interface Layout {
  boardFrac: number;
  titleFrac: number;
  boardCy: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { boardFrac: 0.6, titleFrac: 0.036, boardCy: 0.4 };
    case "9:16":
      return { boardFrac: 0.9, titleFrac: 0.046, boardCy: 0.4 };
    case "4:5":
      return { boardFrac: 0.86, titleFrac: 0.042, boardCy: 0.4 };
    case "1:1":
    default:
      return { boardFrac: 0.86, titleFrac: 0.04, boardCy: 0.4 };
  }
}

const BOARD_AT = 0.3;
const ART_AT = 0.9;
const DURATION = 5.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#DCE7F0"));
  const textColor = str(values.textColor, pc("textColor", "#12181F"));
  const accent = str(values.accent, pc("accent", "#E0483C"));
  const headline = str(values.headline, "Made for mornings");
  const caption = str(values.caption, "").trim();
  const showFigure = on(values.showFigure);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const boardW = size.width * L.boardFrac;
  const boardH = boardW * 0.42;
  const boardCy = size.height * L.boardCy;
  const groundY = size.height * 0.86;
  const titleSize = Math.round(size.width * L.titleFrac);

  const timeline = new JimaTimeline();

  // --- Ground ---
  root.addChild(new Graphics().rect(0, groundY, size.width, size.height - groundY).fill({ color: textColor, alpha: 0.08 }));

  const rig = new Container();
  rig.position.set(cx, 0);
  root.addChild(rig);

  // --- Posts ---
  const postW = boardW * 0.035;
  const postTop = boardCy + boardH / 2;
  for (const s of [-1, 1]) {
    rig.addChild(
      new Graphics()
        .rect(s * boardW * 0.24 - postW / 2, postTop, postW, groundY - postTop)
        .fill({ color: textColor, alpha: 0.55 }),
    );
  }
  // Cross-brace, which is what makes it read as a structure and not a sign.
  rig.addChild(
    new Graphics()
      .poly([-boardW * 0.24, postTop + (groundY - postTop) * 0.4, boardW * 0.24, postTop + (groundY - postTop) * 0.66], false)
      .stroke({ color: textColor, width: Math.max(2, postW * 0.28), alpha: 0.32 }),
  );

  // --- The board ---
  const board = new Container();
  board.position.set(0, boardCy);
  rig.addChild(board);
  const frame = boardW * 0.02;
  board.addChild(
    new Graphics()
      .rect(-boardW / 2 - frame, -boardH / 2 - frame, boardW + frame * 2, boardH + frame * 2)
      .fill({ color: textColor, alpha: 0.75 }),
  );
  board.addChild(new Graphics().rect(-boardW / 2, -boardH / 2, boardW, boardH).fill(accent));

  const art = new Container();
  board.addChild(art);
  const tex = isImageRef(values.artwork) ? images.artwork : null;
  if (tex) {
    const sp = new Sprite(tex);
    const sc = Math.max(boardW / sp.texture.width, boardH / sp.texture.height);
    sp.scale.set(sc);
    sp.anchor.set(0.5);
    const clip = new Graphics().rect(-boardW / 2, -boardH / 2, boardW, boardH).fill("#FFFFFF");
    art.addChild(sp, clip);
    sp.mask = clip;
  } else {
    const h = makeText(fonts, {
      text: headline,
      role: "display",
      weight: 800,
      size: boardH * 0.24,
      color: bg,
      anchor: 0.5,
      align: "center",
    });
    if (h.width > boardW * 0.84) h.scale.set((boardW * 0.84) / h.width);
    art.addChild(h);
    art.addChild(new Graphics().rect(-boardW * 0.06, boardH * 0.24, boardW * 0.12, Math.max(3, boardH * 0.02)).fill({ color: bg, alpha: 0.8 }));
  }
  art.alpha = 0;
  timeline
    .to(art, { prop: "alpha", from: 0, to: 1, start: ART_AT, duration: 0.5, ease: outQuad })
    .to(art, { prop: "scale.x", from: 1.06, to: 1, start: ART_AT, duration: 0.9, ease: outExpo })
    .to(art, { prop: "scale.y", from: 1.06, to: 1, start: ART_AT, duration: 0.9, ease: outExpo });

  // --- The figure at the base, for scale ---
  if (showFigure) {
    const fh = (groundY - postTop) * 0.34;
    const fig = new Container();
    fig.position.set(boardW * 0.36, groundY);
    fig.addChild(new Graphics().circle(0, -fh * 0.85, fh * 0.14).fill({ color: textColor, alpha: 0.6 }));
    fig.addChild(
      new Graphics()
        .roundRect(-fh * 0.11, -fh * 0.68, fh * 0.22, fh * 0.68, fh * 0.08)
        .fill({ color: textColor, alpha: 0.6 }),
    );
    fig.alpha = 0;
    rig.addChild(fig);
    timeline
      .to(fig, { prop: "alpha", from: 0, to: 1, start: ART_AT + 0.35, duration: 0.5, ease: outQuad })
      .to(fig, { prop: "x", from: boardW * 0.42, to: boardW * 0.36, start: ART_AT + 0.35, duration: 1.1, ease: outQuint });
  }

  rig.alpha = 0;
  timeline
    .to(rig, { prop: "alpha", from: 0, to: 1, start: BOARD_AT, duration: 0.45, ease: outQuad })
    .to(rig, { prop: "y", from: -boardH * 0.2, to: 0, start: BOARD_AT, duration: 1.0, ease: outExpo });

  // --- Caption under the scene ---
  if (caption.length > 0) {
    const c = makeText(fonts, { text: caption, role: "body", weight: 700, size: titleSize, color: textColor, anchor: 0.5 });
    const cyy = groundY + (size.height - groundY) * 0.5;
    if (c.width > size.width * 0.86) c.scale.set((size.width * 0.86) / c.width);
    c.alpha = 0;
    c.position.set(cx, cyy);
    root.addChild(c);
    timeline
      .to(c, { prop: "alpha", from: 0, to: 0.85, start: ART_AT + 0.55, duration: 0.5, ease: outQuad })
      .to(c, { prop: "y", from: cyy + titleSize * 0.3, to: cyy, start: ART_AT + 0.55, duration: 0.8, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const billboardMockup: TemplateDefinition = {
  id: "billboard-mockup",
  name: "Billboard",
  tagline: "Your work on an out-of-home board, with a figure at the base to give it scale.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { headline: "display", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "artwork", type: "image", label: "Billboard artwork", default: null, optional: true },
    { key: "headline", type: "text", label: "Or this headline", default: "Made for mornings", maxLength: 40, shrinkToFit: true },
    { key: "caption", type: "text", label: "Caption", default: "Out now · Lisbon, Av. da Liberdade", maxLength: 50, optional: true },
    { key: "showFigure", type: "toggle", label: "Figure for scale", default: true },
    { key: "background", type: "color", label: "Sky", default: "", optional: true },
    { key: "textColor", type: "color", label: "Structure & text", default: "", optional: true },
    { key: "accent", type: "color", label: "Board", default: "", optional: true },
  ],
  build,
};
