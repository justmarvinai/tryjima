import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// A phone mockup + app icon + two store-badge pills — "Download the app".
const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", textColor: "#14140F", accent: "#2E63F6", screenBg: "#EEF1F6", phoneBody: "#14140F", badgeBg: "#14140F", badgeText: "#FFFFFF", onAccent: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F5EF", textColor: "#0A1F16", accent: "#0B7050", screenBg: "#F1F7F4", phoneBody: "#10221A", badgeBg: "#10221A", badgeText: "#FFFFFF", onAccent: "#FFFFFF" } },
  { id: "violet", name: "Violet", colors: { background: "#F1ECFB", textColor: "#180F2E", accent: "#6D3BEA", screenBg: "#F4F0FC", phoneBody: "#1A1330", badgeBg: "#1A1330", badgeText: "#FFFFFF", onAccent: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#14161A", textColor: "#FFFFFF", accent: "#4ADE9B", screenBg: "#232830", phoneBody: "#0C0E12", badgeBg: "#FFFFFF", badgeText: "#14161A", onAccent: "#0A140F" } },
];

/** A phone mockup with a screen, notch, and a centered app icon (appName initial). */
function makePhone(pw: number, ph: number, body: string, screen: string, accent: string, onAccent: string, initial: string, fonts: FontRegistry): Container {
  const c = new Container();
  const r = pw * 0.16;
  // soft drop shadow
  c.addChild(new Graphics().roundRect(-pw / 2, -ph / 2 + ph * 0.02, pw, ph, r).fill({ color: 0x000000, alpha: 0.16 }));
  // body
  c.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, r).fill(body));
  const sInset = pw * 0.055;
  const sr = r * 0.7;
  c.addChild(new Graphics().roundRect(-pw / 2 + sInset, -ph / 2 + sInset, pw - sInset * 2, ph - sInset * 2, sr).fill(screen));
  // notch
  c.addChild(new Graphics().roundRect(-pw * 0.14, -ph / 2 + sInset * 1.1, pw * 0.28, pw * 0.07, pw * 0.035).fill(body));
  // app icon
  const iconS = pw * 0.42;
  const icon = new Container();
  icon.addChild(new Graphics().roundRect(-iconS / 2, -iconS / 2, iconS, iconS, iconS * 0.26).fill(accent));
  icon.addChild(makeText(fonts, { text: initial, role: "display", weight: 700, size: Math.round(iconS * 0.6), color: onAccent, anchor: 0.5 }));
  icon.position.set(0, -ph * 0.06);
  icon.label = "appicon";
  c.addChild(icon);
  return c;
}

/** A store badge pill: left glyph + two lines. */
function storePill(width: number, h: number, badgeBg: string, badgeText: string, top: string, bottom: string, kind: "apple" | "play", fonts: FontRegistry): Container {
  const c = new Container();
  c.addChild(new Graphics().roundRect(-width / 2, -h / 2, width, h, h * 0.26).fill(badgeBg));
  const glyphCx = -width / 2 + h * 0.62;
  const gs = h * 0.5;
  if (kind === "apple") {
    const g = new Graphics();
    g.circle(-gs * 0.12, gs * 0.05, gs * 0.62).fill(badgeText);
    g.circle(gs * 0.5, gs * 0.05, gs * 0.5).fill(badgeBg); // bite
    g.ellipse(gs * 0.16, -gs * 0.7, gs * 0.2, gs * 0.34).fill(badgeText); // leaf
    g.position.set(glyphCx, 0);
    c.addChild(g);
  } else {
    const play = makeIcon("play", gs * 1.1, { color: badgeText });
    play.position.set(glyphCx, 0);
    c.addChild(play);
  }
  const textLeft = glyphCx + h * 0.5;
  const topText = makeText(fonts, { text: top, role: "body", weight: 500, size: Math.round(h * 0.2), color: badgeText, anchor: { x: 0, y: 0.5 }, letterSpacing: 0.5 });
  topText.position.set(textLeft, -h * 0.19);
  topText.alpha = 0.85;
  const bottomText = makeText(fonts, { text: bottom, role: "display", weight: 700, size: Math.round(h * 0.32), color: badgeText, anchor: { x: 0, y: 0.5 } });
  bottomText.position.set(textLeft, h * 0.14);
  c.addChild(topText, bottomText);
  return c;
}

function pillNeededWidth(h: number, top: string, bottom: string, fonts: FontRegistry): number {
  const topW = fonts.measure(top, { family: fonts.family("body"), weight: 500, size: Math.round(h * 0.2) });
  const botW = fonts.measure(bottom, { family: fonts.family("display"), weight: 700, size: Math.round(h * 0.32) });
  return h * 1.12 + Math.max(topW, botW) + h * 0.5;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const aspect: Aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const accent = str(values.accent, pc("accent", "#2E63F6"));
  const screenBg = pc("screenBg", "#EEF1F6");
  const phoneBody = pc("phoneBody", "#14140F");
  const badgeBg = pc("badgeBg", "#14140F");
  const badgeText = pc("badgeText", "#FFFFFF");
  const onAccent = pc("onAccent", "#FFFFFF");

  const appName = str(values.appName, "Aero");
  const tagline = str(values.tagline, "Shop faster on the go");
  const hasTagline = tagline.length > 0;
  const showBadges = values.showBadges !== false;
  const initial = (appName.trim().charAt(0) || "A").toUpperCase();

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const zoneRight = zone.x + zone.width;
  const horizontal = aspect === "16:9" || aspect === "1:1";

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Text + pill metrics ---
  const pillH = minDim * 0.094;
  const pillGap = minDim * 0.026;
  const gapNameTag = minDim * 0.02;
  const gapTagPills = minDim * 0.05;

  const pillW = showBadges
    ? Math.max(pillNeededWidth(pillH, "Download on the", "App Store", fonts), pillNeededWidth(pillH, "GET IT ON", "Google Play", fonts))
    : 0;
  const pillsBlockH = showBadges ? pillH * 2 + pillGap : 0;

  // Resolve layout anchors per orientation.
  let phoneCx: number;
  let phoneCy: number;
  let pw: number;
  let ph: number;
  let contentX: number; // left edge (horizontal) or center (vertical)
  let contentAnchor: 0 | 0.5;
  let contentMaxW: number;
  let contentTop: number;
  let pillCx: number;

  const nameSize0 = Math.round(minDim * (horizontal ? 0.062 : 0.06));
  const tagSize0 = Math.round(minDim * (horizontal ? 0.03 : 0.036));

  if (horizontal) {
    pw = minDim * 0.3;
    ph = pw * 1.95;
    phoneCx = zone.x + pw * 0.5 + minDim * 0.03;
    phoneCy = zone.y + zone.height / 2;
    contentX = phoneCx + pw * 0.5 + minDim * 0.08;
    contentAnchor = 0;
    contentMaxW = zoneRight - contentX;
    pillCx = contentX + (showBadges ? pillW / 2 : 0);
    const nameSizeH = fitSize(fonts, appName, "display", 700, nameSize0, contentMaxW);
    const nameH = nameSizeH * 1.16;
    const tagH = hasTagline ? tagSize0 * 1.3 : 0;
    const blockH = nameH + (hasTagline ? gapNameTag + tagH : 0) + (showBadges ? gapTagPills + pillsBlockH : 0);
    contentTop = phoneCy - blockH / 2;
  } else {
    pw = minDim * 0.34;
    ph = pw * 1.9;
    contentX = cx;
    contentAnchor = 0.5;
    contentMaxW = zone.width * 0.86;
    pillCx = cx;
    const nameSizeV = fitSize(fonts, appName, "display", 700, nameSize0, contentMaxW);
    const nameH = nameSizeV * 1.16;
    const tagH = hasTagline ? tagSize0 * 1.3 : 0;
    const contentH = nameH + (hasTagline ? gapNameTag + tagH : 0) + (showBadges ? gapTagPills + pillsBlockH : 0);
    const gapPhoneContent = minDim * 0.06;
    const stackH = ph + gapPhoneContent + contentH;
    const top = zone.y + (zone.height - stackH) / 2;
    phoneCx = cx;
    phoneCy = top + ph / 2;
    contentTop = top + ph + gapPhoneContent;
  }

  const nameSize = fitSize(fonts, appName, "display", 700, nameSize0, contentMaxW);
  const nameH = nameSize * 1.16;
  const tagSize = hasTagline ? fitSize(fonts, tagline, "body", 500, tagSize0, contentMaxW) : 0;
  const tagH = hasTagline ? tagSize * 1.3 : 0;

  // --- Phone (slides up + springs in) ---
  const phone = makePhone(pw, ph, phoneBody, screenBg, accent, onAccent, initial, fonts);
  phone.position.set(phoneCx, phoneCy);
  phone.alpha = 0;
  phone.scale.set(0.9);
  root.addChild(phone);
  timeline
    .to(phone, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.35, ease: outQuad })
    .to(phone, { prop: "y", from: phoneCy + minDim * 0.06, to: phoneCy, start: 0.12, duration: 0.8, ease: spring(0.5) })
    .to(phone, { prop: "scale.x", from: 0.9, to: 1, start: 0.12, duration: 0.8, ease: spring(0.5) })
    .to(phone, { prop: "scale.y", from: 0.9, to: 1, start: 0.12, duration: 0.8, ease: spring(0.5) });

  // App icon pops on the screen.
  const appIcon = phone.getChildByLabel("appicon");
  if (appIcon) {
    appIcon.scale.set(0);
    timeline
      .to(appIcon, { prop: "scale.x", from: 0, to: 1, start: 0.55, duration: 0.6, ease: spring(0.42) })
      .to(appIcon, { prop: "scale.y", from: 0, to: 1, start: 0.55, duration: 0.6, ease: spring(0.42) });
  }

  // --- App name ---
  let y = contentTop;
  const nameText = makeText(fonts, { text: appName, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: contentAnchor, y: 0 }, align: contentAnchor === 0 ? "left" : "center" });
  nameText.position.set(contentX, y);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.85, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: y + minDim * 0.02, to: y, start: 0.85, duration: 0.55, ease: outExpo });
  y += nameH;

  // --- Tagline ---
  if (hasTagline) {
    y += gapNameTag;
    const tagText = makeText(fonts, { text: tagline, role: "body", weight: 500, size: tagSize, color: textColor, anchor: { x: contentAnchor, y: 0 }, align: contentAnchor === 0 ? "left" : "center" });
    tagText.position.set(contentX, y);
    tagText.alpha = 0;
    root.addChild(tagText);
    timeline
      .to(tagText, { prop: "alpha", from: 0, to: 0.9, start: 1.0, duration: 0.4, ease: outQuad })
      .to(tagText, { prop: "y", from: y + minDim * 0.014, to: y, start: 1.0, duration: 0.5, ease: outQuint });
    y += tagH;
  }

  // --- Store badge pills ---
  if (showBadges) {
    y += gapTagPills;
    const defs: { top: string; bottom: string; kind: "apple" | "play" }[] = [
      { top: "Download on the", bottom: "App Store", kind: "apple" },
      { top: "GET IT ON", bottom: "Google Play", kind: "play" },
    ];
    defs.forEach((d, i) => {
      const pillCy = y + pillH / 2 + i * (pillH + pillGap);
      const pill = storePill(pillW, pillH, badgeBg, badgeText, d.top, d.bottom, d.kind, fonts);
      pill.position.set(pillCx, pillCy);
      pill.alpha = 0;
      pill.scale.set(0.7);
      root.addChild(pill);
      const start = 1.2 + i * 0.15;
      timeline
        .to(pill, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
        .to(pill, { prop: "scale.x", from: 0.7, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) })
        .to(pill, { prop: "scale.y", from: 0.7, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) });
    });
  }

  return { timeline, duration: 4.2 };
}

export const appPromo: TemplateDefinition = {
  id: "app-promo",
  name: "App Promo",
  tagline: "A phone mockup and store badges invite a download of your app.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { appName: "display" },
  palettes: PALETTES,
  fields: [
    { key: "appName", type: "text", label: "App name", default: "Aero", maxLength: 22, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "Shop faster on the go", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showBadges", type: "toggle", label: "Store badges", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
