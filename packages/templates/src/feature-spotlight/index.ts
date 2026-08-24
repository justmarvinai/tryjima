import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  makeOutBack,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";
import { radialGlowTexture } from "../shared/glow";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const ICON_OPTIONS: IconName[] = ["bolt", "heart", "star", "check", "bell", "cart", "pin", "comment"];
const ICON_SET = new Set<string>(ICON_OPTIONS);

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", accent: "#FF4D1C", textColor: "#2A0F06", muted: "#7A6A62", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", muted: "#6B6088", onAccent: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", muted: "#52607A", onAccent: "#FFFFFF" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", accent: "#84CC16", textColor: "#FFFFFF", muted: "#A7ADB8", onAccent: "#101014" } },
];

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/** A word-wrapped text block, shrunk so it fits within (maxWidth × maxHeight). */
function makeWrapped(
  fonts: FontRegistry,
  text: string,
  role: MakeTextOptions["role"],
  weight: number,
  size: number,
  color: string,
  align: "left" | "center",
  maxWidth: number,
  maxHeight: number,
  anchor: { x: number; y: number },
): Text {
  let s = size;
  const make = (px: number): Text => {
    const style = new TextStyle({
      fontFamily: fonts.family(role),
      fontSize: px,
      fontWeight: String(weight) as TextStyle["fontWeight"],
      fill: color,
      align,
      wordWrap: true,
      wordWrapWidth: maxWidth,
      lineHeight: Math.round(px * 1.28),
    });
    const t = new Text({ text, style });
    t.anchor.set(anchor.x, anchor.y);
    return t;
  };
  for (let i = 0; i < 8; i++) {
    const t = make(s);
    if (t.height <= maxHeight || s <= 12) return t;
    s = Math.max(12, Math.floor(s * 0.9));
  }
  return make(s);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#2A0F06"));
  const muted = pc("muted", "#7A6A62");
  const onAccent = pc("onAccent", "#FFFFFF");
  const iconRaw = str(values.icon, "bolt");
  const iconName: IconName = ICON_SET.has(iconRaw) ? (iconRaw as IconName) : "bolt";
  const kicker = str(values.kicker, "");
  const title = str(values.title, "Lightning-fast exports");
  const description = str(values.description, "Renders on your device in seconds — no upload, no wait.");
  const showGlow = values.glow !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const stacked = ctx.aspect === "9:16" || ctx.aspect === "4:5";
  const timeline = new JimaTimeline();

  // Geometry: icon disc + text anchor.
  let discX: number;
  let discY: number;
  let discR: number;
  let textCX: number;
  let textTop: number;
  let textMaxW: number;
  let textAlign: "left" | "center";

  if (stacked) {
    discR = w * 0.17;
    discX = w / 2;
    discY = h * (ctx.aspect === "9:16" ? 0.34 : 0.32);
    textCX = w / 2;
    textTop = discY + discR + h * 0.06;
    textMaxW = w * 0.82;
    textAlign = "center";
  } else {
    discR = h * (ctx.aspect === "16:9" ? 0.24 : 0.2);
    discX = w * (ctx.aspect === "16:9" ? 0.3 : 0.32);
    discY = h / 2;
    textCX = w * (ctx.aspect === "16:9" ? 0.55 : 0.52);
    textTop = h * 0.32;
    textMaxW = w - textCX - w * 0.07;
    textAlign = "left";
  }
  const textAnchorX = textAlign === "center" ? 0.5 : 0;
  const textX = textCX;

  // Soft accent glow behind the icon.
  if (showGlow) {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = accent;
    glow.width = glow.height = discR * 4;
    glow.position.set(discX, discY);
    glow.alpha = 0;
    root.addChild(glow);
    timeline.to(glow, { prop: "alpha", from: 0, to: 0.22, start: 0.1, duration: 0.8, ease: outQuad });
  }

  // Icon disc (accent) → icon glyph.
  const disc = new Container();
  disc.position.set(discX, discY);
  disc.alpha = 0;
  disc.scale.set(0.6);
  disc.rotation = -10 * DEG;
  disc.addChild(new Graphics().circle(0, 0, discR).fill(accent));
  disc.addChild(makeIcon(iconName, discR * 1.15, { color: onAccent, holeColor: accent }));
  root.addChild(disc);
  timeline
    .to(disc, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.4, ease: outQuad })
    .to(disc, { prop: "scale.x", from: 0.6, to: 1, start: 0.25, duration: 0.7, ease: spring(0.5) })
    .to(disc, { prop: "scale.y", from: 0.6, to: 1, start: 0.25, duration: 0.7, ease: spring(0.5) })
    .to(disc, { prop: "rotation", from: -10 * DEG, to: 0, start: 0.25, duration: 0.7, ease: makeOutBack(1.6) });

  // Text column: kicker → title → description.
  let cursorY = textTop;

  if (kicker.length > 0) {
    const kSize = Math.round(w * (stacked ? 0.032 : 0.024));
    const kText = fitText(
      fonts,
      { text: kicker.toUpperCase(), role: "body", weight: 700, size: kSize, color: accent, letterSpacing: kSize * 0.14, anchor: { x: textAnchorX, y: 0 }, align: textAlign },
      textMaxW,
    );
    kText.position.set(textX, cursorY);
    kText.alpha = 0;
    root.addChild(kText);
    timeline
      .to(kText, { prop: "alpha", from: 0, to: 1, start: 0.7, duration: 0.4, ease: outQuad })
      .to(kText, { prop: "y", from: cursorY + 14, to: cursorY, start: 0.7, duration: 0.5, ease: outQuint });
    cursorY += kSize * 1.7;
  }

  const titleSize = Math.round(w * (stacked ? 0.078 : 0.058));
  const titleText = makeWrapped(fonts, title, "display", 700, titleSize, textColor, textAlign, textMaxW, h * 0.34, { x: textAnchorX, y: 0 });
  titleText.position.set(textX, cursorY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "y", from: cursorY + 20, to: cursorY, start: 0.9, duration: 0.6, ease: outQuint });
  cursorY += titleText.height + h * 0.045;

  const descSize = Math.round(w * (stacked ? 0.04 : 0.03));
  const descText = makeWrapped(fonts, description, "body", 500, descSize, muted, textAlign, textMaxW, h * 0.3, { x: textAnchorX, y: 0 });
  descText.position.set(textX, cursorY);
  descText.alpha = 0;
  root.addChild(descText);
  timeline
    .to(descText, { prop: "alpha", from: 0, to: 1, start: 1.15, duration: 0.5, ease: outQuad })
    .to(descText, { prop: "y", from: cursorY + 16, to: cursorY, start: 1.15, duration: 0.6, ease: outQuint });

  return { timeline, duration: 3.8 };
}

export const featureSpotlight: TemplateDefinition = {
  id: "feature-spotlight",
  name: "Feature Spotlight",
  tagline: "One hero feature, big and clean.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "icon", type: "select", label: "Icon", default: "bolt", options: [
      { value: "bolt", label: "Bolt" },
      { value: "heart", label: "Heart" },
      { value: "star", label: "Star" },
      { value: "check", label: "Check" },
      { value: "bell", label: "Bell" },
      { value: "cart", label: "Cart" },
      { value: "pin", label: "Pin" },
      { value: "comment", label: "Comment" },
    ] },
    { key: "kicker", type: "text", label: "Kicker", default: "FEATURE", maxLength: 20, optional: true },
    { key: "title", type: "text", label: "Title", default: "Lightning-fast exports", maxLength: 40, shrinkToFit: true },
    { key: "description", type: "text", label: "Description", default: "Renders on your device in seconds — no upload, no wait.", maxLength: 90, shrinkToFit: true },
    { key: "glow", type: "toggle", label: "Glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
