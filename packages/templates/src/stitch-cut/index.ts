import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  inOutQuint,
  isImageRef,
  makeText,
  outBack,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Stitch — the borrowed clip plays, a scissor line sweeps across, and it cuts
// away to your frame with a "stitching @someone" credit. The reaction format
// that is a *cut*, not a split screen.
//
// `duet-split` puts both clips side by side for the whole video. Here the first
// panel is genuinely replaced, which is the whole grammar of a stitch — and the
// wipe carries a serrated edge so the join reads as a cut rather than a fade.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#131418", textColor: "#F5F5F7", accent: "#22D3EE" } },
  { id: "punch", name: "Punch", colors: { background: "#16101A", textColor: "#F7F0FA", accent: "#F472B6" } },
  { id: "lime", name: "Lime", colors: { background: "#121509", textColor: "#F6FAE9", accent: "#BEF264" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F1", textColor: "#15161A", accent: "#E11D48" } },
];

interface Layout {
  labelFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { labelFrac: 0.03 };
    case "9:16":
      return { labelFrac: 0.042 };
    case "4:5":
      return { labelFrac: 0.038 };
    case "1:1":
    default:
      return { labelFrac: 0.038 };
  }
}

const CUT_AT = 1.15;
const CUT_DUR = 0.55;
const DURATION = 4.6;

/** Fill a frame-sized sprite, or a labelled placeholder panel. */
function panel(ctx: TemplateContext, key: string, fill: string, label: string, labelSize: number): Container {
  const { size, images, values, fonts } = ctx;
  const c = new Container();
  const tex = isImageRef(values[key]) ? images[key] : null;
  if (tex) {
    const sp = new Sprite(tex);
    const scale = Math.max(size.width / sp.texture.width, size.height / sp.texture.height);
    sp.scale.set(scale);
    sp.anchor.set(0.5);
    sp.position.set(size.width / 2, size.height / 2);
    c.addChild(sp);
  } else {
    c.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(fill));
    const t = makeText(fonts, {
      text: label,
      role: "display",
      weight: 800,
      size: labelSize * 1.3,
      color: "#FFFFFF",
      anchor: 0.5,
    });
    t.alpha = 0.24;
    t.position.set(size.width / 2, size.height / 2);
    c.addChild(t);
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#131418"));
  const textColor = str(values.textColor, pc("textColor", "#F5F5F7"));
  const accent = str(values.accent, pc("accent", "#22D3EE"));
  const credit = str(values.credit, "@marta.builds");
  const caption = str(values.caption, "my honest take");
  const showTeeth = on(values.showTeeth);

  const L = layout(ctx.aspect);
  const labelSize = Math.round(size.width * L.labelFrac);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();

  // Original underneath, yours on top behind a wipe that uncovers it.
  root.addChild(panel(ctx, "original", "#3B3F49", "THEIR CLIP", labelSize));
  const mine = panel(ctx, "reaction", accent, "YOUR CLIP", labelSize);
  root.addChild(mine);

  const wipe = new Graphics().rect(-size.width, 0, size.width, size.height).fill("#FFFFFF");
  root.addChild(wipe);
  mine.mask = wipe;
  timeline.to(wipe, { prop: "x", from: 0, to: size.width, start: CUT_AT, duration: CUT_DUR, ease: inOutQuint });

  // --- The blade: a bright edge with saw teeth, riding the wipe front ---
  const blade = new Container();
  root.addChild(blade);
  const bw = Math.max(4, size.width * 0.006);
  blade.addChild(new Graphics().rect(-bw / 2, 0, bw, size.height).fill(textColor));
  if (showTeeth) {
    const teeth = 26;
    const th = size.height / teeth;
    const g = new Graphics();
    for (let i = 0; i < teeth; i++) {
      const y = th * i;
      g.poly([0, y, th * 0.5, y + th * 0.5, 0, y + th]);
    }
    g.fill(textColor);
    g.x = bw / 2;
    blade.addChild(g);
  }
  blade.alpha = 0;
  timeline
    .to(blade, { prop: "alpha", from: 0, to: 1, start: CUT_AT - 0.1, duration: 0.12, ease: outQuad })
    .to(blade, { prop: "x", from: 0, to: size.width, start: CUT_AT, duration: CUT_DUR, ease: inOutQuint })
    .to(blade, { prop: "alpha", from: 1, to: 0, start: CUT_AT + CUT_DUR * 0.7, duration: 0.25, ease: outQuad });

  // --- "Stitching @someone" credit, up before the cut ---
  const creditSize = labelSize * 0.82;
  const creditHolder = new Container();
  const cLabel = makeText(fonts, {
    text: `Stitching ${credit}`,
    role: "body",
    weight: 700,
    size: creditSize,
    color: bg,
    anchor: { x: 0, y: 0.5 },
  });
  const cw = cLabel.width + creditSize * 2.6;
  const ch = creditSize * 2.2;
  creditHolder.addChild(new Graphics().roundRect(0, -ch / 2, cw, ch, ch / 2).fill(textColor));
  // A tiny scissor mark, so the chip says "stitch" without spelling it out.
  const sc = new Graphics()
    .poly([0, -creditSize * 0.34, creditSize * 0.55, creditSize * 0.3], false)
    .poly([0, creditSize * 0.34, creditSize * 0.55, -creditSize * 0.3], false)
    .stroke({ color: bg, width: Math.max(2, creditSize * 0.11), cap: "round" });
  sc.position.set(creditSize * 0.85, 0);
  creditHolder.addChild(sc);
  cLabel.x = creditSize * 1.75;
  creditHolder.addChild(cLabel);
  creditHolder.position.set(size.width * 0.5 - cw / 2, size.height * 0.16);
  creditHolder.alpha = 0;
  root.addChild(creditHolder);
  timeline
    .to(creditHolder, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.35, ease: outQuad })
    .to(creditHolder, { prop: "y", from: size.height * 0.13, to: size.height * 0.16, start: 0.3, duration: 0.7, ease: outExpo })
    .to(creditHolder, { prop: "alpha", from: 1, to: 0, start: CUT_AT + CUT_DUR * 0.4, duration: 0.3, ease: outQuad });

  // --- Your caption, landing once the cut completes ---
  const capSize = labelSize * 1.25;
  const cap = makeText(fonts, {
    text: caption,
    role: "display",
    weight: 800,
    size: capSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
  });
  const maxW = size.width * 0.82;
  if (cap.width > maxW) cap.scale.set(maxW / cap.width);
  const capY = size.height * 0.82;
  cap.position.set(size.width / 2, capY);
  cap.alpha = 0;
  root.addChild(cap);
  timeline
    .to(cap, { prop: "alpha", from: 0, to: 1, start: CUT_AT + CUT_DUR * 0.75, duration: 0.35, ease: outQuad })
    .to(cap, { prop: "y", from: capY + capSize * 0.7, to: capY, start: CUT_AT + CUT_DUR * 0.75, duration: 0.7, ease: outExpo })
    .to(cap, { prop: "scale.x", from: 0.86, to: 1, start: CUT_AT + CUT_DUR * 0.75, duration: 0.6, ease: outBack })
    .to(cap, { prop: "scale.y", from: 0.86, to: 1, start: CUT_AT + CUT_DUR * 0.75, duration: 0.6, ease: outBack });

  return { timeline, duration: DURATION };
}

export const stitchCut: TemplateDefinition = {
  id: "stitch-cut",
  name: "Stitch",
  tagline: "Their clip plays, a serrated blade wipes across, and it cuts to yours.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 1.35,
  fontRoles: { caption: "display", credit: "body" },
  palettes: PALETTES,
  fields: [
    { key: "original", type: "image", label: "Their clip (still)", default: null, optional: true },
    { key: "reaction", type: "image", label: "Your clip (still)", default: null, optional: true },
    { key: "credit", type: "text", label: "Stitching", default: "@marta.builds", maxLength: 26 },
    { key: "caption", type: "text", label: "Your caption", default: "my honest take", maxLength: 40, shrinkToFit: true },
    { key: "showTeeth", type: "toggle", label: "Serrated cut", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text & blade", default: "", optional: true },
    { key: "accent", type: "color", label: "Your panel", default: "", optional: true },
  ],
  build,
};
