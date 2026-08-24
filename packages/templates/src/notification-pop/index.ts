import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", cardText: "#0B0B0F", cardMuted: "#6E6E77", accent: "#FF4D1C" } },
  { id: "mint", name: "Mint", colors: { background: "#E7F7EF", cardBg: "#FFFFFF", cardText: "#0B1F16", cardMuted: "#5E6E66", accent: "#17A34A" } },
  { id: "blush", name: "Blush", colors: { background: "#FCEDF3", cardBg: "#FFFFFF", cardText: "#2A0A1E", cardMuted: "#7A6270", accent: "#FF2E9E" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0C10", cardBg: "#1C1C22", cardText: "#FFFFFF", cardMuted: "#A9AFB9", accent: "#FF4D1C" } },
];

const ICON_CHOICES: IconName[] = ["bell", "heart", "comment", "cart", "star", "user"];

/** Shrink a single-line size so `text` fits `maxWidth`. */
function fitOne(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const wdt = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  if (wdt <= maxWidth || wdt === 0) return size0;
  return Math.max(10, Math.floor(size0 * (maxWidth / wdt)));
}

function bannerWidthFor(aspect: Aspect, w: number, minDim: number): number {
  const frac = aspect === "16:9" ? 0.52 : aspect === "1:1" ? 0.84 : 0.86;
  return Math.min(w * frac, minDim * 0.95);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const cardText = pc("cardText", "#0B0B0F");
  const cardMuted = pc("cardMuted", "#8A8A92");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const white = "#FFFFFF";

  const appName = str(values.appName, "Jima");
  const title = str(values.title, "New follower 🎉");
  const message = str(values.message, "Alex started following you");
  const iconRaw = str(values.icon, "bell");
  const iconName: IconName = (ICON_CHOICES as string[]).includes(iconRaw) ? (iconRaw as IconName) : "bell";

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const bannerW = bannerWidthFor(ctx.aspect, w, minDim);
  const bannerH = bannerW * 0.3;
  const rad = bannerH * 0.24;
  const p = bannerH * 0.15;
  const iconSize = bannerH * 0.5;
  const textLeft = -bannerW / 2 + p + iconSize + p * 0.85;
  const maxW = bannerW / 2 - p - textLeft;

  const cx = w / 2;
  const gap = bannerH * 0.22;
  const cy = ctx.aspect === "9:16" ? 220 + (h - 220 - 400) / 2 : h / 2;

  /** Build one banner centered at the origin (positioned/animated by the caller). */
  const makeBanner = (an: string, titleTxt: string, msgTxt: string, appearAt: number): Container => {
    const c = new Container();

    // Soft shadow (a slightly larger, offset dark rounded-rect behind the card).
    const e = bannerH * 0.02;
    const off = bannerH * 0.05;
    c.addChild(
      new Graphics()
        .roundRect(-bannerW / 2 - e, -bannerH / 2 - e + off, bannerW + e * 2, bannerH + e * 2, rad + e)
        .fill({ color: "#000000", alpha: 0.16 }),
    );

    // Frosted card.
    c.addChild(new Graphics().roundRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, rad).fill(cardBg));

    // App icon (rounded square, accent fill, white glyph) — pops in.
    const iconHolder = new Container();
    iconHolder.position.set(-bannerW / 2 + p + iconSize / 2, 0);
    iconHolder.addChild(new Graphics().roundRect(-iconSize / 2, -iconSize / 2, iconSize, iconSize, iconSize * 0.24).fill(accent));
    iconHolder.addChild(makeIcon(iconName, iconSize * 0.56, { color: white, holeColor: accent }));
    c.addChild(iconHolder);
    timeline
      .to(iconHolder, { prop: "scale.x", from: 0.6, to: 1, start: appearAt + 0.12, duration: 0.5, ease: spring(0.4) })
      .to(iconHolder, { prop: "scale.y", from: 0.6, to: 1, start: appearAt + 0.12, duration: 0.5, ease: spring(0.4) });

    // Top row: app name (left) + "now" (right).
    const appSize = Math.round(bannerH * 0.15);
    const appText = makeText(fonts, { text: an, role: "display", weight: 700, size: appSize, color: cardMuted, anchor: { x: 0, y: 0.5 }, letterSpacing: 0.5 });
    appText.position.set(textLeft, -bannerH * 0.2);
    c.addChild(appText);
    const nowText = makeText(fonts, { text: "now", role: "body", weight: 500, size: Math.round(bannerH * 0.135), color: cardMuted, anchor: { x: 1, y: 0.5 } });
    nowText.position.set(bannerW / 2 - p, -bannerH * 0.2);
    c.addChild(nowText);

    // Title (bold) + message (muted), both shrink to fit.
    const titleSize = fitOne(fonts, titleTxt, "display", 700, Math.round(bannerH * 0.19), maxW);
    const titleText = makeText(fonts, { text: titleTxt, role: "display", weight: 700, size: titleSize, color: cardText, anchor: { x: 0, y: 0.5 } });
    titleText.position.set(textLeft, bannerH * 0.04);
    c.addChild(titleText);

    const msgSize = fitOne(fonts, msgTxt, "body", 400, Math.round(bannerH * 0.155), maxW);
    const msgText = makeText(fonts, { text: msgTxt, role: "body", weight: 400, size: msgSize, color: cardMuted, anchor: { x: 0, y: 0.5 } });
    msgText.position.set(textLeft, bannerH * 0.26);
    c.addChild(msgText);

    c.alpha = 0;
    root.addChild(c);
    return c;
  };

  const drop = bannerH * 1.3;
  const y1 = cy - (bannerH + gap) / 2;
  const y2 = cy + (bannerH + gap) / 2;

  // Banner 1: drops to the centre, settles, then slides up to make room.
  const b1 = makeBanner(appName, title, message, 0.15);
  b1.position.set(cx, cy - drop);
  timeline
    .to(b1, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad })
    .to(b1, { prop: "y", from: cy - drop, to: cy, start: 0.15, duration: 0.9, ease: spring(0.55) })
    .to(b1, { prop: "y", from: cy, to: y1, start: 1.1, duration: 0.65, ease: outExpo });

  // Banner 2: drops in a beat later and stacks below.
  const b2 = makeBanner(appName, "and 3 others", "Tap to see your activity", 1.1);
  b2.position.set(cx, y2 - drop);
  timeline
    .to(b2, { prop: "alpha", from: 0, to: 1, start: 1.1, duration: 0.4, ease: outQuad })
    .to(b2, { prop: "y", from: y2 - drop, to: y2, start: 1.1, duration: 0.9, ease: spring(0.55) });

  return { timeline, duration: 3.6 };
}

export const notificationPop: TemplateDefinition = {
  id: "notification-pop",
  name: "Notification Pop",
  tagline: "iOS-style push banners drop in and stack.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  palettes: PALETTES,
  fields: [
    { key: "appName", type: "text", label: "App name", default: "Jima", maxLength: 20 },
    { key: "title", type: "text", label: "Title", default: "New follower 🎉", maxLength: 40, shrinkToFit: true },
    { key: "message", type: "text", label: "Message", default: "Alex started following you", maxLength: 60 },
    {
      key: "icon",
      type: "select",
      label: "Icon",
      default: "bell",
      options: ICON_CHOICES.map((n) => ({ value: n, label: n.charAt(0).toUpperCase() + n.slice(1) })),
    },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
