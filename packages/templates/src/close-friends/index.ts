import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { avatar } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

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
  return w > maxWidth ? Math.max(11, Math.floor(size0 * (maxWidth / w))) : size0;
}

// An Instagram "Close Friends" story marker: an avatar pops in, a green ring
// draws around it, and a starred "Close Friends" pill + name settle below. The
// ring + star share the `accent` role (default green), so recoloring keeps them
// in sync. Full-frame `bg` carries the background field.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#12141A", accent: "#22C55E", avatarBg: "#12141A", onAvatar: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0C10", textColor: "#FFFFFF", accent: "#2FE06A", avatarBg: "#FFFFFF", onAvatar: "#0B0C10" } },
  { id: "blush", name: "Blush", colors: { background: "#FFF1F5", textColor: "#2A0A18", accent: "#17B978", avatarBg: "#2A0A18", onAvatar: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FF", textColor: "#0B2447", accent: "#12B886", avatarBg: "#0B2447", onAvatar: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#12141A"));
  const accent = str(values.accent, pc("accent", "#22C55E"));
  const avatarBg = pc("avatarBg", "#12141A");
  const onAvatar = pc("onAvatar", "#FFFFFF");
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const name = str(values.name, "maya.creates");
  const badge = str(values.badge, "Close Friends");
  const showRing = on(values.showRing);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry: avatar (+ring), pill, name — vertically centered ---
  const avR = Math.round(minDim * 0.135);
  const ringGap = Math.round(avR * 0.14);
  const ringW = Math.max(3, Math.round(avR * 0.09));
  const outerR = avR + ringGap + ringW;

  const pillH = Math.round(minDim * 0.078);
  const starS = pillH * 0.5;
  const badgeSize = fitSize(fonts, badge, "display", 700, Math.round(pillH * 0.42), safe.width * 0.7);
  const badgeW = fonts.measure(badge, { family: fonts.family("display"), weight: 700, size: badgeSize });
  const pillW = starS + pillH * 0.34 + badgeW + pillH * 0.9;

  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * 0.05), safe.width * 0.86);

  const gap1 = Math.round(minDim * 0.055);
  const gap2 = Math.round(minDim * 0.04);
  const blockH = outerR * 2 + gap1 + pillH + gap2 + nameSize;
  const top = safe.y + Math.max(0, (safe.height - blockH) / 2);
  const avCy = top + outerR;
  const pillCy = avCy + outerR + gap1 + pillH / 2;
  const nameCy = pillCy + pillH / 2 + gap2 + nameSize / 2;

  // --- Green ring (behind the avatar) ---
  if (showRing) {
    const ring = new Graphics().circle(0, 0, avR + ringGap + ringW / 2).stroke({ color: accent, width: ringW });
    ring.position.set(cx, avCy);
    ring.scale.set(1.18);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.35, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 1.18, to: 1, start: 0.3, duration: 0.6, ease: spring(0.5) })
      .to(ring, { prop: "scale.y", from: 1.18, to: 1, start: 0.3, duration: 0.6, ease: spring(0.5) });
  }

  // --- Avatar ---
  const initial = (name.trim()[0] ?? "A").toUpperCase();
  const av = avatar(fonts, { radius: avR, bg: avatarBg, initial, textColor: onAvatar });
  av.position.set(cx, avCy);
  av.scale.set(0);
  root.addChild(av);
  timeline
    .to(av, { prop: "scale.x", from: 0, to: 1, start: 0.12, duration: 0.6, ease: spring(0.46) })
    .to(av, { prop: "scale.y", from: 0, to: 1, start: 0.12, duration: 0.6, ease: spring(0.46) });

  // --- "Close Friends" star pill ---
  const pill = new Container();
  pill.position.set(cx, pillCy);
  pill.scale.set(0);
  root.addChild(pill);
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent));
  const star = makeIcon("star", starS, { color: onAccent });
  star.position.set(-pillW / 2 + pillH * 0.45 + starS / 2, 0);
  pill.addChild(star);
  const badgeText = makeText(fonts, { text: badge, role: "display", weight: 700, size: badgeSize, color: onAccent, anchor: { x: 0, y: 0.5 } });
  badgeText.position.set(-pillW / 2 + pillH * 0.45 + starS + pillH * 0.34, 0);
  pill.addChild(badgeText);
  timeline
    .to(pill, { prop: "scale.x", from: 0, to: 1, start: 0.6, duration: 0.5, ease: makeOutBack(1.9) })
    .to(pill, { prop: "scale.y", from: 0, to: 1, start: 0.6, duration: 0.5, ease: makeOutBack(1.9) });

  // --- Name ---
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameCy);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.8, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameCy + minDim * 0.02, to: nameCy, start: 0.8, duration: 0.5, ease: outExpo });

  return { timeline, duration: 3.8 };
}

export const closeFriends: TemplateDefinition = {
  id: "close-friends",
  name: "Close Friends",
  tagline: "A green ring draws around an avatar with a starred Close Friends pill.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { name: "display", badge: "display" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "maya.creates", maxLength: 24, shrinkToFit: true },
    { key: "badge", type: "text", label: "Badge text", default: "Close Friends", maxLength: 20, shrinkToFit: true },
    { key: "showRing", type: "toggle", label: "Green ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Ring & star", default: "", optional: true },
  ],
  build,
};
