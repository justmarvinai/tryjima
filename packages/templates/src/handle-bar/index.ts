import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  makeOutBack,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

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

const ICON_OPTIONS: IconName[] = ["play", "user", "bell", "heart"];

// A social "subscribe" lower-third: a fully-rounded pill slides in from the
// left edge with a platform-icon badge, a bold @handle, and a subtitle line.
// Only the full-frame `bg` rect is tied to the background field (defaults to
// the transparent sentinel so it composites straight onto footage); the pill
// uses its own palette-only `pillBg` so it survives as overlay content once
// the canvas fill is gone. `accentText` is a fixed, contrast-checked palette
// color for the icon glyph sitting on the `accent` badge (not user-editable,
// so the badge stays legible under any accent pick).
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { pillBg: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", accentText: "#101014" } },
  { id: "midnight", name: "Midnight", colors: { pillBg: "#17171C", textColor: "#FFFFFF", accent: "#33D9C4", accentText: "#101014" } },
  { id: "mint", name: "Mint", colors: { pillBg: "#FFFFFF", textColor: "#08221A", accent: "#17A34A", accentText: "#101014" } },
  { id: "grape", name: "Grape", colors: { pillBg: "#241443", textColor: "#FFFFFF", accent: "#FF7CD1", accentText: "#101014" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const pillBg = pc("pillBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const accentText = pc("accentText", "#101014");
  const handleRaw = str(values.handle, "yourhandle");
  const handleTxt = handleRaw.startsWith("@") ? handleRaw : `@${handleRaw}`;
  const subtitle = str(values.subtitle, "Subscribe for more");
  const iconRaw = str(values.icon, "play");
  const iconName: IconName = (ICON_OPTIONS as readonly string[]).includes(iconRaw) ? (iconRaw as IconName) : "play";
  const showIcon = values.showIcon !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const padX = Math.round(minDim * 0.032);
  const padY = Math.round(minDim * 0.02);
  const iconR = Math.round(minDim * 0.036);
  const gapIconText = Math.round(minDim * 0.024);
  const rowGap = Math.round(minDim * 0.008);

  const iconBlockW = showIcon ? iconR * 2 + gapIconText : 0;
  const maxTextW = Math.max(120, w * 0.62 - iconBlockW);

  const handleSize = fitSize(fonts, handleTxt, "display", 700, Math.round(minDim * 0.04), maxTextW);
  const subSize = subtitle.length > 0 ? fitSize(fonts, subtitle, "body", 500, Math.round(minDim * 0.023), maxTextW) : 0;

  const handleW = fonts.measure(handleTxt, { family: fonts.family("display"), weight: 700, size: handleSize });
  const subW = subtitle.length > 0 ? fonts.measure(subtitle, { family: fonts.family("body"), weight: 500, size: subSize }) : 0;
  const textBlockW = Math.max(handleW, subW);

  const textRowsH = subtitle.length > 0 ? handleSize + rowGap + subSize : handleSize;
  const contentH = Math.max(showIcon ? iconR * 2 : 0, textRowsH);
  const pillW = padX * 2 + iconBlockW + textBlockW;
  const pillH = padY * 2 + contentH;

  const marginBottom = Math.round(minDim * 0.03);
  const restX = zone.left + pillW / 2;
  const restY = h - zone.bottom - marginBottom - pillH / 2;
  const slideDist = pillW + minDim * 0.08;
  const startX = restX - slideDist;

  const pill = new Container();
  pill.position.set(startX, restY);
  pill.alpha = 0;
  root.addChild(pill);

  // Soft shadow so the pill reads as a distinct surface over any footage.
  const e = Math.round(pillH * 0.04);
  const off = Math.round(pillH * 0.07);
  pill.addChild(
    new Graphics()
      .roundRect(-pillW / 2 - e, -pillH / 2 - e + off, pillW + e * 2, pillH + e * 2, pillH / 2 + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(pillBg));

  let cursorX = -pillW / 2 + padX;
  let badge: Container | undefined;
  if (showIcon) {
    badge = new Container();
    badge.position.set(cursorX + iconR, 0);
    badge.scale.set(0);
    badge.addChild(new Graphics().circle(0, 0, iconR).fill(accent));
    badge.addChild(makeIcon(iconName, iconR * 1.05, { color: accentText }));
    pill.addChild(badge);
    cursorX += iconR * 2 + gapIconText;
  }

  const textX = cursorX;
  const blockH = textRowsH;
  const handleY = subtitle.length > 0 ? -blockH / 2 + handleSize / 2 : 0;
  const subY = subtitle.length > 0 ? blockH / 2 - subSize / 2 : 0;

  const handleText = makeText(fonts, {
    text: handleTxt,
    role: "display",
    weight: 700,
    size: handleSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  handleText.position.set(textX, handleY);
  pill.addChild(handleText);

  if (subtitle.length > 0) {
    const subText = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    subText.alpha = 0.72;
    subText.position.set(textX, subY);
    pill.addChild(subText);
  }

  // --- Entrance: slides in from the left edge, with a soft fade. ---
  const enterStart = 0.1;
  const enterDur = 0.55;
  timeline
    .to(pill, { prop: "x", from: startX, to: restX, start: enterStart, duration: enterDur, ease: makeOutBack(1.35) })
    .to(pill, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.28, ease: outQuad });

  // --- Icon badge pops in just after the pill lands (toggleable). ---
  if (badge) {
    const popStart = enterStart + enterDur * 0.7;
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: popStart, duration: 0.4, ease: makeOutBack(2.2) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: popStart, duration: 0.4, ease: makeOutBack(2.2) });
  }

  return { timeline, duration: 4.0 };
}

export const handleBar: TemplateDefinition = {
  id: "handle-bar",
  name: "Handle Bar",
  tagline: "A subscribe-style pill slides in with a platform icon and handle.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { handle: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "handle", type: "text", label: "Handle", default: "yourhandle", maxLength: 24, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "Subscribe for more", maxLength: 40, optional: true, shrinkToFit: true },
    {
      key: "icon",
      type: "select",
      label: "Icon",
      default: "play",
      options: [
        { value: "play", label: "Play" },
        { value: "user", label: "Profile" },
        { value: "bell", label: "Bell" },
        { value: "heart", label: "Heart" },
      ],
    },
    { key: "showIcon", type: "toggle", label: "Icon badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
