import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  spring,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

interface Stat {
  value: number;
  decimals: number;
  suffix: string;
}
/** Parse a compact count like "24.5K", "1,208", "892" into an animatable value. */
function parseStat(raw: string): Stat {
  const m = /^\s*(\d[\d,]*)(\.(\d+))?\s*([a-zA-Z%]*)\s*$/.exec(raw);
  if (!m) return { value: 0, decimals: 0, suffix: "" };
  const intPart = (m[1] ?? "0").replace(/,/g, "");
  const decPart = m[3] ?? "";
  const suffix = m[4] ?? "";
  const value = Number(intPart + (decPart ? "." + decPart : ""));
  return { value: Number.isFinite(value) ? value : 0, decimals: decPart.length, suffix };
}
function formatStat(s: Stat, frac: number): string {
  const v = s.value * frac;
  if (s.decimals > 0) return v.toFixed(s.decimals) + s.suffix;
  return groupThousands(Math.round(v)) + s.suffix;
}
function measureWidth(fonts: FontRegistry, s: string, size: number): number {
  return fonts.measure(s, { family: fonts.family("display"), weight: 700, size });
}
function shrink(fonts: FontRegistry, s: string, size: number, maxW: number): number {
  if (s.length === 0 || maxW <= 0) return size;
  const w = measureWidth(fonts, s, size);
  return w > maxW ? Math.max(10, Math.floor((size * maxW) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#F4F6FA", textColor: "#101014", accent: "#FF3B5C", onAccent: "#FFFFFF", muted: "#E2E6EE" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0C10", textColor: "#FFFFFF", accent: "#FF4D6D", onAccent: "#FFFFFF", muted: "#24262E" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF3FF", textColor: "#0B2447", accent: "#2E7DF6", onAccent: "#FFFFFF", muted: "#D3E3FB" } },
  { id: "sunset", name: "Sunset", colors: { background: "#1B1020", textColor: "#FFFFFF", accent: "#FF6A3D", onAccent: "#FFFFFF", muted: "#2E1C33" } },
];

interface RailSpec {
  icon: IconName;
  key: string;
  def: string;
  isHeart: boolean;
}
const SPECS: RailSpec[] = [
  { icon: "heart", key: "likes", def: "24.5K", isHeart: true },
  { icon: "comment", key: "comments", def: "1,208", isHeart: false },
  { icon: "bookmark", key: "saves", def: "3,402", isHeart: false },
  { icon: "share", key: "shares", def: "892", isHeart: false },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF3B5C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const muted = pc("muted", "#E2E6EE");
  const showAvatar = values.showAvatar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const stats = SPECS.map((s) => parseStat(str(values[s.key], s.def)));

  // --- Sizing (fits the tightest safe zone; counts shrink to their own cell) ---
  const avR = minDim * 0.058;
  const iconSize = minDim * 0.074;
  const gapIC = minDim * 0.012; // icon -> count
  const gapItems = minDim * 0.032;
  const gapAvatarFirst = minDim * 0.042;
  const badgeR = avR * 0.42;

  const railInset = minDim * 0.088;
  const railCx = safe.x + safe.width - railInset;
  const maxCountW = railInset * 1.9;

  const countFont0 = Math.round(minDim * 0.03);
  const countFont = Math.min(
    countFont0,
    ...stats.map((s) => shrink(fonts, formatStat(s, 1), countFont0, maxCountW)),
  );
  const itemH = iconSize + gapIC + countFont;

  const total = (showAvatar ? 2 * avR + gapAvatarFirst : 0) + SPECS.length * itemH + (SPECS.length - 1) * gapItems;
  let cursor = safe.y + Math.max(0, (safe.height - total) / 2);

  // --- Avatar + follow badge ---
  if (showAvatar) {
    const avCy = cursor + avR;
    const av = new Container();
    av.position.set(railCx, avCy);
    av.scale.set(0);
    root.addChild(av);
    av.addChild(new Graphics().circle(0, 0, avR + minDim * 0.006).fill({ color: textColor, alpha: 0.12 }));
    av.addChild(new Graphics().circle(0, 0, avR).fill(muted));
    av.addChild(makeIcon("user", avR * 1.15, { color: textColor }));
    timeline
      .to(av, { prop: "scale.x", from: 0, to: 1, start: 0.05, duration: 0.6, ease: spring(0.5) })
      .to(av, { prop: "scale.y", from: 0, to: 1, start: 0.05, duration: 0.6, ease: spring(0.5) });

    const badge = new Container();
    badge.position.set(railCx, avCy + avR * 0.92);
    badge.scale.set(0);
    root.addChild(badge);
    badge.addChild(new Graphics().circle(0, 0, badgeR + minDim * 0.004).fill(bg));
    badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
    badge.addChild(makeIcon("plus", badgeR * 1.1, { color: onAccent }));
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.5, ease: makeOutBack(2.4) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.5, ease: makeOutBack(2.4) });

    cursor += 2 * avR + gapAvatarFirst;
  }

  // --- Engagement items ---
  const baseStart = showAvatar ? 0.42 : 0.12;
  const stagger = 0.12;
  const counts: { text: Text; stat: Stat; cs: number; ce: number }[] = [];

  SPECS.forEach((spec, i) => {
    const iconCy = cursor + iconSize / 2;
    const countCy = iconCy + iconSize / 2 + gapIC + countFont / 2;

    const item = new Container();
    item.position.set(railCx, iconCy);
    item.scale.set(0);
    item.alpha = 0;
    root.addChild(item);
    item.addChild(makeIcon(spec.icon, iconSize, { color: spec.isHeart ? accent : textColor, holeColor: bg }));

    const countText = makeText(fonts, {
      text: formatStat(stats[i]!, 0),
      role: "display",
      weight: 700,
      size: countFont,
      color: textColor,
      anchor: 0.5,
    });
    countText.position.set(railCx, countCy);
    countText.alpha = 0;
    root.addChild(countText);

    const start = baseStart + i * stagger;
    timeline
      .to(item, { prop: "alpha", from: 0, to: 1, start, duration: 0.28, ease: outQuad })
      .to(item, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.9) })
      .to(item, { prop: "scale.y", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.9) })
      .to(countText, { prop: "alpha", from: 0, to: 1, start: start + 0.15, duration: 0.35, ease: outQuad });

    // heart gets a little confirmation beat once it lands
    if (spec.isHeart) {
      const pulse = start + 0.5;
      timeline
        .to(item, { prop: "scale.x", from: 1, to: 1.16, start: pulse, duration: 0.14, ease: outQuad })
        .to(item, { prop: "scale.y", from: 1, to: 1.16, start: pulse, duration: 0.14, ease: outQuad })
        .to(item, { prop: "scale.x", from: 1.16, to: 1, start: pulse + 0.14, duration: 0.26, ease: outQuad })
        .to(item, { prop: "scale.y", from: 1.16, to: 1, start: pulse + 0.14, duration: 0.26, ease: outQuad });
    }

    const cs = start + 0.22;
    counts.push({ text: countText, stat: stats[i]!, cs, ce: cs + 0.7 });
    cursor += itemH + gapItems;
  });

  const update = (t: number): void => {
    for (const c of counts) {
      const u = t <= c.cs ? 0 : t >= c.ce ? 1 : (t - c.cs) / (c.ce - c.cs);
      c.text.text = formatStat(c.stat, outCubic(u));
    }
  };

  return { timeline, duration: 3.4, update };
}

export const actionRail: TemplateDefinition = {
  id: "action-rail",
  name: "Action Rail",
  tagline: "The vertical engagement rail springs in and every count rolls up.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { likes: "display", comments: "display", saves: "display", shares: "display" },
  palettes: PALETTES,
  fields: [
    { key: "likes", type: "text", label: "Likes", default: "24.5K", maxLength: 10, help: "Counts up. Use K/M for compact." },
    { key: "comments", type: "text", label: "Comments", default: "1,208", maxLength: 10, help: "Counts up." },
    { key: "saves", type: "text", label: "Saves", default: "3,402", maxLength: 10, help: "Counts up." },
    { key: "shares", type: "text", label: "Shares", default: "892", maxLength: 10, help: "Counts up." },
    { key: "showAvatar", type: "toggle", label: "Avatar + follow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
