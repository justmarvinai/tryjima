import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

// Badge Unlock — an achievement badge assembles from its own rays, snaps to
// size, and takes a shine across the metal. The "you just hit a thing" beat,
// which the library only had as a plain counter (`milestone-counter`) or a
// streak flame.
//
// The badge is a real polygon rosette rather than a circle: the notched edge is
// what makes a shape read as *earned* rather than as a button.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "gold", name: "Gold", colors: { background: "#14131A", textColor: "#F7F5EE", accent: "#F2B33D" } },
  { id: "emerald", name: "Emerald", colors: { background: "#0C1815", textColor: "#EAF7F2", accent: "#34D399" } },
  { id: "violet", name: "Violet", colors: { background: "#140F1E", textColor: "#F2EFFA", accent: "#A78BFA" } },
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#16171B", accent: "#E0483C" } },
];

interface Layout {
  badgeFrac: number;
  titleFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { badgeFrac: 0.22, titleFrac: 0.048, centerFrac: 0.42 };
    case "9:16":
      return { badgeFrac: 0.42, titleFrac: 0.062, centerFrac: 0.42 };
    case "4:5":
      return { badgeFrac: 0.4, titleFrac: 0.058, centerFrac: 0.42 };
    case "1:1":
    default:
      return { badgeFrac: 0.4, titleFrac: 0.058, centerFrac: 0.42 };
  }
}

const RAYS_AT = 0.25;
const SNAP_AT = 0.7;
const DURATION = 4.4;

const ICONS: IconName[] = ["star", "bolt", "heart", "check", "bookmark", "play"];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#14131A"));
  const textColor = str(values.textColor, pc("textColor", "#F7F5EE"));
  const accent = str(values.accent, pc("accent", "#F2B33D"));
  const title = str(values.title, "Top 1% creator");
  const subtitle = str(values.subtitle, "").trim();
  const iconName = (str(values.icon, "star") as IconName) ?? "star";
  const showRays = on(values.showRays);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const R = Math.min(size.width, size.height) * L.badgeFrac * 0.5;

  const timeline = new JimaTimeline();

  // --- Rays behind, fanning out then settling ---
  if (showRays) {
    const rays = new Container();
    rays.position.set(cx, cy);
    root.addChild(rays);
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const w = R * 0.09;
      const g = new Graphics().poly([-w, 0, w, 0, 0, R * 1.55]).fill({ color: accent, alpha: 0.35 });
      g.rotation = a;
      rays.addChild(g);
    }
    rays.scale.set(0.2);
    rays.alpha = 0;
    timeline
      .to(rays, { prop: "alpha", from: 0, to: 1, start: RAYS_AT, duration: 0.3, ease: outQuad })
      .to(rays, { prop: "scale.x", from: 0.2, to: 1, start: RAYS_AT, duration: 0.9, ease: outExpo })
      .to(rays, { prop: "scale.y", from: 0.2, to: 1, start: RAYS_AT, duration: 0.9, ease: outExpo })
      .to(rays, { prop: "rotation", from: -0.5, to: 0, start: RAYS_AT, duration: 1.4, ease: outQuint })
      .to(rays, { prop: "alpha", from: 1, to: 0.42, start: SNAP_AT + 0.2, duration: 0.7, ease: outQuad });
  }

  // --- The badge: a 12-point notched rosette ---
  const badge = new Container();
  badge.position.set(cx, cy);
  root.addChild(badge);

  const pts: number[] = [];
  const teeth = 12;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (Math.PI * i) / teeth - Math.PI / 2;
    const rr = i % 2 === 0 ? R : R * 0.9;
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  badge.addChild(new Graphics().poly(pts).fill(accent));
  badge.addChild(
    new Graphics().circle(0, 0, R * 0.78).stroke({ color: bg, width: Math.max(2, R * 0.045), alpha: 0.35 }),
  );

  const icon = makeIcon(ICONS.includes(iconName) ? iconName : "star", R * 0.78, { color: bg, holeColor: accent });
  badge.addChild(icon);

  badge.scale.set(0);
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: SNAP_AT, duration: 0.65, ease: outBack })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: SNAP_AT, duration: 0.65, ease: outBack })
    .to(badge, { prop: "rotation", from: -0.35, to: 0, start: SNAP_AT, duration: 0.9, ease: outExpo });

  // A shine sweeping across the metal once it lands.
  const shineClip = new Graphics().poly(pts).fill("#FFFFFF");
  const shine = new Graphics()
    .poly([-R * 0.16, -R * 1.4, R * 0.16, -R * 1.4, R * 0.5, R * 1.4, R * 0.18, R * 1.4])
    .fill({ color: "#FFFFFF", alpha: 0.42 });
  badge.addChild(shine, shineClip);
  shine.mask = shineClip;
  timeline
    .to(shine, { prop: "x", from: -R * 1.6, to: R * 1.6, start: SNAP_AT + 0.35, duration: 0.7, ease: outQuad })
    .to(shine, { prop: "alpha", from: 0.45, to: 0, start: SNAP_AT + 0.8, duration: 0.35, ease: outQuad });

  // --- Title & subtitle ---
  const titleSize = Math.round(size.width * L.titleFrac);
  const titleY = cy + R * 1.5;
  const t = makeText(fonts, {
    text: title,
    role: "display",
    weight: 800,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
  });
  const maxW = size.width * 0.82;
  if (t.width > maxW) t.scale.set(maxW / t.width);
  t.position.set(cx, titleY);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: SNAP_AT + 0.35, duration: 0.45, ease: outQuad })
    .to(t, { prop: "y", from: titleY + titleSize * 0.4, to: titleY, start: SNAP_AT + 0.35, duration: 0.8, ease: outExpo });

  if (subtitle.length > 0) {
    const s = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: Math.round(titleSize * 0.5),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const sy = titleY + titleSize * 1.05;
    s.alpha = 0;
    s.position.set(cx, sy);
    root.addChild(s);
    timeline
      .to(s, { prop: "alpha", from: 0, to: 0.7, start: SNAP_AT + 0.6, duration: 0.5, ease: outQuad })
      .to(s, { prop: "y", from: sy + titleSize * 0.2, to: sy, start: SNAP_AT + 0.6, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const badgeUnlock: TemplateDefinition = {
  id: "badge-unlock",
  name: "Badge Unlock",
  tagline: "A notched achievement badge assembles out of its own rays and takes a shine.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Achievement", default: "Top 1% creator", maxLength: 32, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Detail", default: "Unlocked this week", maxLength: 40, optional: true },
    {
      key: "icon",
      type: "select",
      label: "Icon",
      default: "star",
      options: [
        { value: "star", label: "Star" },
        { value: "bolt", label: "Bolt" },
        { value: "heart", label: "Heart" },
        { value: "check", label: "Check" },
        { value: "bookmark", label: "Bookmark" },
        { value: "play", label: "Play" },
      ],
    },
    { key: "showRays", type: "toggle", label: "Rays", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Badge", default: "", optional: true },
  ],
  build,
};
