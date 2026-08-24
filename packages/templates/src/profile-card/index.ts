import { Container, Graphics, Sprite, type Text, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
  spring,
  safeRect,
  shrinkToFit,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#6B7280", imageBack: "#ECECEC", onAccent: "#FFFFFF" } },
  { id: "dark", name: "Dark", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF6A3D", muted: "#9BA0AE", imageBack: "#26262C", onAccent: "#FFFFFF" } },
  { id: "insta-pop", name: "Insta Pop", colors: { background: "#FFF6FA", textColor: "#2A0A20", accent: "#DD2A7B", muted: "#8C6478", imageBack: "#FBDCEA", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0D0D11", textColor: "#FFFFFF", accent: "#FE2C55", muted: "#9098A6", imageBack: "#1E1E24", onAccent: "#FFFFFF" } },
];

interface Stat {
  value: number;
  decimals: number;
  suffix: string;
}

/** Parse a compact stat like "18.2K", "312", "94" into an animatable value. */
function parseStat(raw: string): Stat {
  const m = /^\s*(\d[\d,]*)(\.(\d+))?\s*([a-zA-Z%]*)\s*$/.exec(raw);
  if (!m) return { value: 0, decimals: 0, suffix: "" };
  const intPart = m[1]!.replace(/,/g, "");
  const decPart = m[3] ?? "";
  const suffix = m[4] ?? "";
  const value = Number(intPart + (decPart ? "." + decPart : ""));
  return { value: Number.isFinite(value) ? value : 0, decimals: decPart.length, suffix };
}

/** Format a mid-count value, preserving the stat's decimal precision + suffix. */
function formatStat(s: Stat, frac: number): string {
  const v = s.value * frac;
  if (s.decimals > 0) return v.toFixed(s.decimals) + s.suffix;
  return groupThousands(Math.round(v)) + s.suffix;
}

function avatarFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.13 : aspect === "9:16" ? 0.15 : 0.155;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const muted = pc("muted", "#6B7280");
  const imageBack = str(values.imageBack, pc("imageBack", "#ECECEC"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const name = str(values.name, "Alex Rivera");
  const handle = str(values.handle, "@alexcreates");
  const showFollow = values.showFollow !== false;
  const postsStat = parseStat(str(values.posts, "94"));
  const followersStat = parseStat(str(values.followers, "18.2K"));
  const followingStat = parseStat(str(values.following, "312"));

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;

  const familyDisplay = fonts.family("display");
  const measureDisplay = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
  const familyBody = fonts.family("body");
  const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 600, size: sz });

  // --- Sizes ---
  const avatarR = minDim * avatarFrac(ctx.aspect);
  const nameBase = Math.round(minDim * 0.062);
  const nameSize = shrinkToFit(name, measureDisplay, { maxWidth: safe.width * 0.88, baseSize: nameBase, minSize: Math.round(nameBase * 0.5) });
  const handleBase = Math.round(nameSize * 0.46);
  const handleSize = shrinkToFit(handle, measureBody, { maxWidth: safe.width * 0.8, baseSize: handleBase, minSize: Math.round(handleBase * 0.6) });
  const pillLabelSize = Math.round(minDim * 0.036);
  const pillH = Math.round(pillLabelSize * 2.5);

  const cols: { label: string; stat: Stat }[] = [
    { label: "Posts", stat: postsStat },
    { label: "Followers", stat: followersStat },
    { label: "Following", stat: followingStat },
  ];
  const colW = Math.min(safe.width, minDim * 0.92) / 3;
  let statNumSize = Math.round(minDim * 0.05);
  for (const c of cols) {
    const full = formatStat(c.stat, 1);
    statNumSize = Math.min(statNumSize, shrinkToFit(full, measureDisplay, { maxWidth: colW * 0.86, baseSize: statNumSize, minSize: Math.round(statNumSize * 0.5) }));
  }
  let statLabelSize = Math.round(statNumSize * 0.4);
  for (const c of cols) {
    statLabelSize = Math.min(statLabelSize, shrinkToFit(c.label, measureBody, { maxWidth: colW * 0.9, baseSize: statLabelSize, minSize: Math.round(statLabelSize * 0.6) }));
  }
  const statsRowH = statNumSize * 1.05 + statLabelSize * 1.3;

  // --- Vertical rhythm (cumulative, centered in the safe rect) ---
  const gapAvatarName = avatarR * 0.5;
  const gapNameHandle = nameSize * 0.4;
  const gapHandleFollow = handleSize * 0.85;
  const gapFollowStats = pillH * 0.6;

  const totalH =
    avatarR * 2 +
    gapAvatarName +
    nameSize * 1.1 +
    gapNameHandle +
    handleSize * 1.1 +
    gapHandleFollow +
    (showFollow ? pillH : 0) +
    gapFollowStats +
    statsRowH;
  const top = safe.y + safe.height / 2 - totalH / 2;

  let cursor = top;
  const avatarCy = cursor + avatarR;
  cursor += avatarR * 2 + gapAvatarName;
  const nameCy = cursor + nameSize * 0.55;
  cursor += nameSize * 1.1 + gapNameHandle;
  const handleCy = cursor + handleSize * 0.55;
  cursor += handleSize * 1.1 + gapHandleFollow;
  const pillCy = cursor + pillH / 2;
  if (showFollow) cursor += pillH;
  cursor += gapFollowStats;
  const statsCy = cursor + statsRowH / 2;

  // --- Avatar (circular; image or a placeholder disc + user icon) ---
  const avatarHolder = new Container();
  avatarHolder.label = "avatar";
  avatarHolder.position.set(cx, avatarCy);
  const tex: Texture | null = images.image ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = (2 * avatarR) / Math.min(tex.width, tex.height);
    s.scale.set(cover);
    const mask = new Graphics().circle(0, 0, avatarR).fill(0xffffff);
    avatarHolder.addChild(s, mask);
    s.mask = mask;
  } else {
    avatarHolder.addChild(new Graphics().circle(0, 0, avatarR).fill(imageBack));
    const iconColor = luminance(imageBack) < 0.5 ? "#8A8F9A" : "#B7BCC6";
    avatarHolder.addChild(makeIcon("user", avatarR * 1.05, { color: iconColor }));
  }
  avatarHolder.addChild(new Graphics().circle(0, 0, avatarR).stroke({ color: accent, width: Math.max(3, avatarR * 0.05) }));
  avatarHolder.scale.set(0);
  root.addChild(avatarHolder);
  timeline
    .to(avatarHolder, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.65, ease: spring(0.45) })
    .to(avatarHolder, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.65, ease: spring(0.45) });

  // --- Name ---
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameCy + 22);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameCy + 22, to: nameCy, start: 0.5, duration: 0.55, ease: outExpo });

  // --- Handle ---
  const handleText = makeText(fonts, { text: handle, role: "body", weight: 500, size: handleSize, color: muted, anchor: 0.5, align: "center" });
  handleText.position.set(cx, handleCy + 18);
  handleText.alpha = 0;
  root.addChild(handleText);
  timeline
    .to(handleText, { prop: "alpha", from: 0, to: 1, start: 0.62, duration: 0.4, ease: outQuad })
    .to(handleText, { prop: "y", from: handleCy + 18, to: handleCy, start: 0.62, duration: 0.5, ease: outExpo });

  // --- Follow pill ---
  if (showFollow) {
    const followLabel = makeText(fonts, { text: "Follow", role: "display", weight: 700, size: pillLabelSize, color: onAccent, anchor: 0.5 });
    const pillPadX = pillLabelSize * 1.2;
    const pillW = followLabel.width + pillPadX * 2;
    const pillC = new Container();
    pillC.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent));
    pillC.addChild(followLabel);
    pillC.position.set(cx, pillCy);
    pillC.scale.set(0);
    root.addChild(pillC);
    timeline
      .to(pillC, { prop: "scale.x", from: 0, to: 1, start: 0.85, duration: 0.55, ease: makeOutBack(1.7) })
      .to(pillC, { prop: "scale.y", from: 0, to: 1, start: 0.85, duration: 0.55, ease: makeOutBack(1.7) });
  }

  // --- Stats row: Posts / Followers / Following ---
  const statsRow = new Container();
  statsRow.position.set(cx, statsCy);
  statsRow.alpha = 0;
  statsRow.scale.set(0.9);
  root.addChild(statsRow);

  const COUNT_STARTS = [1.25, 1.37, 1.49];
  const COUNT_DUR = 0.85;
  const numberNodes: { text: Text; stat: Stat }[] = [];

  cols.forEach((col, i) => {
    const localX = (i - 1) * colW;
    const numberText = makeText(fonts, { text: formatStat(col.stat, 0), role: "display", weight: 700, size: statNumSize, color: textColor, anchor: 0.5 });
    numberText.position.set(localX, -statLabelSize * 0.55);
    statsRow.addChild(numberText);
    numberNodes.push({ text: numberText, stat: col.stat });

    const labelText = makeText(fonts, { text: col.label, role: "body", weight: 600, size: statLabelSize, color: muted, anchor: 0.5 });
    labelText.position.set(localX, statNumSize * 0.52);
    statsRow.addChild(labelText);

    if (i > 0) {
      const divH = Math.min(statNumSize * 1.3, statsRowH * 0.75);
      const div = new Graphics().roundRect(-1, -divH / 2, 2, divH, 1).fill(muted);
      div.position.set(localX - colW / 2, 0);
      div.alpha = 0.5;
      statsRow.addChild(div);
    }

    const start = COUNT_STARTS[i] ?? 1.25;
    const end = start + COUNT_DUR;
    timeline
      .to(numberText, { prop: "scale.x", from: 1, to: 1.08, start: end, duration: 0.12, ease: outQuad })
      .to(numberText, { prop: "scale.y", from: 1, to: 1.08, start: end, duration: 0.12, ease: outQuad })
      .to(numberText, { prop: "scale.x", from: 1.08, to: 1, start: end + 0.12, duration: 0.22, ease: outQuad })
      .to(numberText, { prop: "scale.y", from: 1.08, to: 1, start: end + 0.12, duration: 0.22, ease: outQuad });
  });

  timeline
    .to(statsRow, { prop: "alpha", from: 0, to: 1, start: 1.05, duration: 0.45, ease: outQuad })
    .to(statsRow, { prop: "scale.x", from: 0.9, to: 1, start: 1.05, duration: 0.55, ease: outQuint })
    .to(statsRow, { prop: "scale.y", from: 0.9, to: 1, start: 1.05, duration: 0.55, ease: outQuint });

  const update = (t: number): void => {
    numberNodes.forEach((n, i) => {
      const start = COUNT_STARTS[i] ?? 1.25;
      const u = clamp01((t - start) / COUNT_DUR);
      const eased = 1 - Math.pow(1 - u, 3);
      n.text.text = formatStat(n.stat, eased);
    });
  };

  return { timeline, duration: 4.6, update };
}

export const profileCard: TemplateDefinition = {
  id: "profile-card",
  name: "Profile Card",
  tagline: "A social profile header settles in, then follower stats count up.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { name: "display", handle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Alex Rivera", maxLength: 26, shrinkToFit: true },
    { key: "handle", type: "text", label: "Handle", default: "@alexcreates", maxLength: 24, shrinkToFit: true },
    { key: "image", type: "image", label: "Avatar image", default: "", optional: true },
    { key: "posts", type: "text", label: "Posts", default: "94", maxLength: 10 },
    { key: "followers", type: "text", label: "Followers", default: "18.2K", maxLength: 10, help: "Counts up. Use K/M for compact (18.2K)." },
    { key: "following", type: "text", label: "Following", default: "312", maxLength: 10 },
    { key: "showFollow", type: "toggle", label: "Follow button", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "imageBack", type: "color", label: "Image back", default: "", optional: true },
  ],
  build,
};
