import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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

/** A small right-pointing chevron ("›"), centered at the origin. */
function makeChevron(size: number, color: string): Graphics {
  const s = size;
  return new Graphics()
    .poly([-0.22 * s, -0.32 * s, 0.26 * s, 0, -0.22 * s, 0.32 * s], false)
    .stroke({ color, width: Math.max(2, s * 0.16), cap: "round", join: "round" });
}

// A bottom call-to-action bar. Only the full-frame `bg` rect is tied to the
// background field (blanked by transparent export); the banner uses its own
// palette-only `barBg` so the CTA survives as overlay content.
const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", barBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "white-ink", name: "White on ink", colors: { background: "#101014", barBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6" } },
  { id: "berry-pop", name: "Berry pop", colors: { background: "#FFF0F5", barBg: "#2A0A1E", textColor: "#FFF3F8", accent: "#FF2E9E" } },
  { id: "mint-fresh", name: "Mint fresh", colors: { background: "#0B1F16", barBg: "#EAFBF3", textColor: "#0B1F16", accent: "#17A34A" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const barBg = pc("barBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const label = str(values.label, "Follow for more");
  const sublabel = str(values.sublabel, "");
  const showArrow = values.showArrow !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const padX = Math.round(minDim * 0.05);
  const padY = Math.round(minDim * 0.028);
  const gapLabelSub = Math.round(minDim * 0.01);
  const gapTextArrow = Math.round(minDim * 0.03);
  const arrowSize = Math.round(minDim * 0.03);

  const maxBannerW = w - zone.left - zone.right;
  const maxTextW = Math.max(80, maxBannerW - padX * 2 - (showArrow ? arrowSize + gapTextArrow : 0));

  const labelSize = fitSize(fonts, label, "display", 700, Math.round(minDim * 0.042), maxTextW);
  const subSize = sublabel.length > 0 ? fitSize(fonts, sublabel, "body", 500, Math.round(minDim * 0.021), maxTextW) : 0;

  const labelW = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: labelSize });
  const subW = sublabel.length > 0 ? fonts.measure(sublabel, { family: fonts.family("body"), weight: 500, size: subSize }) : 0;
  const textBlockW = Math.max(labelW, subW);
  const textBlockH = sublabel.length > 0 ? labelSize + gapLabelSub + subSize : labelSize;

  const bannerH = padY * 2 + textBlockH;
  const bannerW = Math.min(maxBannerW, padX * 2 + textBlockW + (showArrow ? arrowSize + gapTextArrow : 0));
  const bannerRadius = Math.min(Math.round(bannerH * 0.28), Math.round(minDim * 0.03));

  const marginBottom = Math.round(minDim * 0.025);
  const restY = h - zone.bottom - marginBottom - bannerH / 2;
  const startY = restY + minDim * 0.22;

  const banner = new Container();
  banner.position.set(w / 2, startY);
  root.addChild(banner);

  const e = Math.round(minDim * 0.006);
  const off = Math.round(minDim * 0.01);
  banner.addChild(
    new Graphics()
      .roundRect(-bannerW / 2 - e, -bannerH / 2 - e + off, bannerW + e * 2, bannerH + e * 2, bannerRadius + e)
      .fill({ color: "#000000", alpha: 0.2 }),
  );
  banner.addChild(new Graphics().roundRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, bannerRadius).fill(barBg));

  const leftEdge = -bannerW / 2 + padX;
  const labelY = sublabel.length > 0 ? -textBlockH / 2 + labelSize / 2 : 0;
  const subY = sublabel.length > 0 ? textBlockH / 2 - subSize / 2 : 0;

  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 700,
    size: labelSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  labelText.position.set(leftEdge, labelY);
  banner.addChild(labelText);

  if (sublabel.length > 0) {
    const subText = makeText(fonts, {
      text: sublabel,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    subText.alpha = 0.75;
    subText.position.set(leftEdge, subY);
    banner.addChild(subText);
  }

  const arrowRestX = bannerW / 2 - padX - arrowSize * 0.5;
  let arrow: Graphics | undefined;
  if (showArrow) {
    arrow = makeChevron(arrowSize, accent);
    arrow.position.set(arrowRestX, 0);
    banner.addChild(arrow);
  }

  // Entrance: the whole banner slides up from just below the frame.
  const enterStart = 0.15;
  const enterDur = 0.6;
  timeline.to(banner, { prop: "y", from: startY, to: restY, start: enterStart, duration: enterDur, ease: outExpo });

  // Arrow keeps nudging right, gently, for the rest of the hold.
  const settleT = enterStart + enterDur;
  const update = (t: number): void => {
    if (!arrow) return;
    if (t < settleT) {
      arrow.x = arrowRestX;
      return;
    }
    arrow.x = arrowRestX + Math.sin((t - settleT) * 3.2) * minDim * 0.012;
  };

  return { timeline, duration: 4.2, update };
}

export const ctaBar: TemplateDefinition = {
  id: "cta-bar",
  name: "CTA Bar",
  tagline: "A bottom call-to-action banner slides up with a nudging arrow.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { label: "display", sublabel: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Follow for more", maxLength: 40, shrinkToFit: true },
    { key: "sublabel", type: "text", label: "Sublabel", default: "New drops every week", maxLength: 48, optional: true, shrinkToFit: true },
    { key: "showArrow", type: "toggle", label: "Arrow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
