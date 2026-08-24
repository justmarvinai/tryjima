import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  makeOutBack,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "coral-cobalt", name: "Coral vs cobalt", colors: { leftColor: "#FF4D1C", rightColor: "#2E5BD6", badgeColor: "#101014", labelColor: "#FFFFFF" } },
  { id: "ink-lime", name: "Ink vs lime", colors: { leftColor: "#101014", rightColor: "#D8F34D", badgeColor: "#FF4D1C", labelColor: "#FFFFFF" } },
  { id: "peach-teal", name: "Peach vs teal", colors: { leftColor: "#FF8A6B", rightColor: "#12A199", badgeColor: "#101014", labelColor: "#FFFFFF" } },
  { id: "mono-duo", name: "Mono duo", colors: { leftColor: "#2A2A30", rightColor: "#8A8A94", badgeColor: "#FF4D1C", labelColor: "#FFFFFF" } },
];

function panel(
  poly: number[],
  color: string,
  tex: Texture | null,
  size: { width: number; height: number },
): Container {
  const c = new Container();
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(size.width / tex.width, size.height / tex.height);
    s.scale.set(cover);
    s.position.set(size.width / 2, size.height / 2);
    const mask = new Graphics().poly(poly).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
    // Subtle color scrim for label legibility.
    const scrim = new Graphics().poly(poly).fill({ color, alpha: 0.28 });
    c.addChild(scrim);
  } else {
    c.addChild(new Graphics().poly(poly).fill(color));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const leftColor = str(values.leftColor, pc("leftColor", "#FF4D1C"));
  const rightColor = str(values.rightColor, pc("rightColor", "#2E5BD6"));
  const badgeColor = pc("badgeColor", "#101014");
  const labelColor = pc("labelColor", "#FFFFFF");
  const leftLabel = str(values.leftLabel, "Before");
  const rightLabel = str(values.rightLabel, "After");
  const badge = str(values.badge, "VS");
  const badgeStyle = str(values.badgeStyle, "punch");
  const diagonal = str(values.split, "vertical") === "diagonal";

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  const slant = diagonal ? W * 0.08 : 0;

  const leftPoly = [0, 0, cx + slant, 0, cx - slant, H, 0, H];
  const rightPoly = [cx + slant, 0, W, 0, W, H, cx - slant, H];

  const timeline = new JimaTimeline();

  const leftPanel = panel(leftPoly, leftColor, images.leftImage ?? null, size);
  const rightPanel = panel(rightPoly, rightColor, images.rightImage ?? null, size);
  root.addChild(leftPanel, rightPanel);
  leftPanel.x = -W / 2;
  rightPanel.x = W / 2;
  timeline
    .to(leftPanel, { prop: "x", from: -W / 2, to: 0, start: 0.0, duration: 0.7, ease: outExpo })
    .to(rightPanel, { prop: "x", from: W / 2, to: 0, start: 0.0, duration: 0.7, ease: outExpo });

  // Labels.
  const labelSize = Math.round(W * (ctx.aspect === "16:9" ? 0.055 : 0.07));
  const makeLabel = (text: string, x: number, delay: number) => {
    const t = makeText(fonts, { text, role: "display", weight: 700, size: labelSize, color: labelColor, anchor: 0.5, align: "center" });
    t.position.set(x, H * 0.5);
    t.alpha = 0;
    root.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: delay, duration: 0.4, ease: outQuad })
      .to(t, { prop: "y", from: H * 0.5 + 16, to: H * 0.5, start: delay, duration: 0.45, ease: outQuad });
  };
  makeLabel(leftLabel, W * 0.26, 0.7);
  makeLabel(rightLabel, W * 0.74, 0.85);

  // Badge at the seam.
  if (badgeStyle !== "none") {
    const r = W * (ctx.aspect === "9:16" ? 0.13 : 0.1);
    const badgeC = new Container();
    badgeC.position.set(cx, H * 0.5);
    badgeC.addChild(new Graphics().circle(0, 0, r).fill(badgeColor).stroke({ color: 0xffffff, width: Math.max(2, r * 0.06) }));
    badgeC.addChild(makeText(fonts, { text: badge, role: "display", weight: 700, size: Math.round(r * 0.95), color: "#FFFFFF", anchor: 0.5 }));
    badgeC.scale.set(0);
    root.addChild(badgeC);
    if (badgeStyle === "spin") {
      badgeC.rotation = Math.PI;
      timeline
        .to(badgeC, { prop: "scale.x", from: 0, to: 1, start: 1.2, duration: 0.5, ease: makeOutBack(1.4) })
        .to(badgeC, { prop: "scale.y", from: 0, to: 1, start: 1.2, duration: 0.5, ease: makeOutBack(1.4) })
        .to(badgeC, { prop: "rotation", from: Math.PI, to: 0, start: 1.2, duration: 0.6, ease: outExpo });
    } else {
      timeline
        .to(badgeC, { prop: "scale.x", from: 1.6, to: 1, start: 1.2, duration: 0.4, ease: makeOutBack(2) })
        .to(badgeC, { prop: "scale.y", from: 1.6, to: 1, start: 1.2, duration: 0.4, ease: makeOutBack(2) })
        .to(badgeC, { prop: "alpha", from: 0, to: 1, start: 1.2, duration: 0.15, ease: outQuad });
    }
  }

  return { timeline, duration: 5.0 };
}

export const splitDuo: TemplateDefinition = {
  id: "split-duo",
  name: "Split Duo",
  tagline: "Two sides face off with a punchy VS badge.",
  category: "comparison",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 1.8,
  palettes: PALETTES,
  fields: [
    { key: "leftLabel", type: "text", label: "Left label", default: "Before", maxLength: 24 },
    { key: "rightLabel", type: "text", label: "Right label", default: "After", maxLength: 24 },
    { key: "leftImage", type: "image", label: "Left image", default: "", optional: true },
    { key: "rightImage", type: "image", label: "Right image", default: "", optional: true },
    { key: "badge", type: "text", label: "Badge", default: "VS", maxLength: 8 },
    { key: "badgeStyle", type: "select", label: "Badge style", default: "punch", options: [{ value: "punch", label: "Punch" }, { value: "spin", label: "Spin" }, { value: "none", label: "None" }] },
    { key: "split", type: "select", label: "Split", default: "vertical", options: [{ value: "vertical", label: "Vertical" }, { value: "diagonal", label: "Diagonal" }] },
    { key: "leftColor", type: "color", label: "Left", default: "", optional: true },
    { key: "rightColor", type: "color", label: "Right", default: "", optional: true },
  ],
  build,
};
