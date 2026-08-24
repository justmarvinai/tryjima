import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeInBack,
  outQuad,
  outExpo,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const DEG = Math.PI / 180;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", textColor: "#2A0F06", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "royal", name: "Royal", colors: { background: "#EEF2FF", textColor: "#0B1E52", accent: "#3455E6", onAccent: "#FFFFFF" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", textColor: "#3A0A28", accent: "#FF2E9E", onAccent: "#FFFFFF" } },
];

type Style = "burst" | "rings" | "scalloped";

/** Create text, shrinking one size if it would overflow `maxWidth` (crisp). */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/** The seal shape (no text), centered at origin, radius R. */
function makeSeal(style: Style, R: number, accent: string, onAccent: string): Container {
  const c = new Container();
  const line = Math.max(2, R * 0.02);
  if (style === "rings") {
    c.addChild(new Graphics().circle(0, 0, R).fill(accent));
    c.addChild(new Graphics().circle(0, 0, R * 0.88).stroke({ color: onAccent, width: Math.max(2, R * 0.03) }));
    c.addChild(new Graphics().circle(0, 0, R * 0.8).stroke({ color: onAccent, width: line }));
  } else if (style === "scalloped") {
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      c.addChild(new Graphics().circle(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86, R * 0.12).fill(accent));
    }
    c.addChild(new Graphics().circle(0, 0, R * 0.86).fill(accent));
    c.addChild(new Graphics().circle(0, 0, R * 0.7).stroke({ color: onAccent, width: line }));
  } else {
    c.addChild(new Graphics().star(0, 0, 20, R, R * 0.82).fill(accent));
    c.addChild(new Graphics().circle(0, 0, R * 0.78).fill(accent));
    c.addChild(new Graphics().circle(0, 0, R * 0.66).stroke({ color: onAccent, width: line }));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const badgeText = str(values.badgeText, "NEW");
  const topLabel = str(values.topLabel, "");
  const bottomLabel = str(values.bottomLabel, "");
  const style = str(values.style, "burst") as Style;
  const showRing = values.ring !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const cx = size.width / 2;
  const cy = size.height / 2;
  const R = Math.min(size.width, size.height) * 0.33;
  const timeline = new JimaTimeline();

  // Impact ring behind the badge.
  const ring = new Graphics().circle(0, 0, R).stroke({ color: accent, width: Math.max(3, R * 0.03) });
  ring.position.set(cx, cy);
  ring.scale.set(0.7);
  ring.alpha = 0;
  if (showRing) root.addChild(ring);

  // The badge (seal + text), stamped as one unit.
  const badge = new Container();
  badge.position.set(cx, cy);
  badge.addChild(makeSeal(style, R, accent, onAccent));

  const hasLabels = topLabel.length > 0 || bottomLabel.length > 0;
  const btSize = Math.round(R * (hasLabels ? 0.46 : 0.54));
  const bt = fitText(
    fonts,
    { text: badgeText, role: "display", weight: 700, size: btSize, color: onAccent, anchor: 0.5, align: "center" },
    R * 1.35,
  );
  bt.position.set(0, 0);
  badge.addChild(bt);

  if (topLabel.length > 0) {
    const tl = fitText(
      fonts,
      { text: topLabel, role: "body", weight: 600, size: Math.round(R * 0.12), color: onAccent, anchor: 0.5, letterSpacing: R * 0.03 },
      R * 1.3,
    );
    tl.position.set(0, -R * 0.46);
    badge.addChild(tl);
  }
  if (bottomLabel.length > 0) {
    const bl = fitText(
      fonts,
      { text: bottomLabel, role: "body", weight: 600, size: Math.round(R * 0.12), color: onAccent, anchor: 0.5, letterSpacing: R * 0.03 },
      R * 1.3,
    );
    bl.position.set(0, R * 0.46);
    badge.addChild(bl);
  }

  badge.scale.set(2.2);
  badge.rotation = -12 * DEG;
  badge.alpha = 0.15;
  root.addChild(badge);

  const STAMP = 0.5;
  timeline
    // Slam: big/faint/rotated → full size on impact.
    .to(badge, { prop: "alpha", from: 0.15, to: 1, start: STAMP, duration: 0.12, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 2.2, to: 1, start: STAMP, duration: 0.34, ease: makeInBack(1.6) })
    .to(badge, { prop: "scale.y", from: 2.2, to: 1, start: STAMP, duration: 0.34, ease: makeInBack(1.6) })
    .to(badge, { prop: "rotation", from: -12 * DEG, to: 2 * DEG, start: STAMP, duration: 0.2, ease: outExpo })
    // Post-impact shake (quick rotation wiggles that settle to 0).
    .to(badge, { prop: "rotation", from: 2 * DEG, to: -3 * DEG, start: STAMP + 0.2, duration: 0.08, ease: outQuad })
    .to(badge, { prop: "rotation", from: -3 * DEG, to: 1.6 * DEG, start: STAMP + 0.28, duration: 0.08, ease: outQuad })
    .to(badge, { prop: "rotation", from: 1.6 * DEG, to: -0.8 * DEG, start: STAMP + 0.36, duration: 0.08, ease: outQuad })
    .to(badge, { prop: "rotation", from: -0.8 * DEG, to: 0, start: STAMP + 0.44, duration: 0.14, ease: outQuad });

  // Expanding impact ring.
  if (showRing) {
    timeline
      .to(ring, { prop: "scale.x", from: 0.7, to: 1.9, start: STAMP, duration: 0.6, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.7, to: 1.9, start: STAMP, duration: 0.6, ease: outExpo })
      .to(ring, { prop: "alpha", from: 0.9, to: 0, start: STAMP, duration: 0.6, ease: outQuad });
  }

  return { timeline, duration: 3.2 };
}

export const badgeStamp: TemplateDefinition = {
  id: "badge-stamp",
  name: "Badge Stamp",
  tagline: "A seal stamps down with an impact ring.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 1.6,
  palettes: PALETTES,
  fields: [
    { key: "badgeText", type: "text", label: "Badge text", default: "NEW", maxLength: 10, shrinkToFit: true },
    { key: "topLabel", type: "text", label: "Top label", default: "OFFICIAL", maxLength: 18, optional: true },
    { key: "bottomLabel", type: "text", label: "Bottom label", default: "SINCE 2026", maxLength: 18, optional: true },
    {
      key: "style",
      type: "select",
      label: "Seal style",
      default: "burst",
      options: [
        { value: "burst", label: "Burst" },
        { value: "rings", label: "Rings" },
        { value: "scalloped", label: "Scalloped" },
      ],
    },
    { key: "ring", type: "toggle", label: "Impact ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
