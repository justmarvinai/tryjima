import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outBack,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { makePill, avatar } from "../shared/ui";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

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
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#0F0F0F", accent: "#FF0033", muted: "#E5E5E5" } },
  { id: "dark", name: "Dark", colors: { background: "#0F0F0F", textColor: "#FFFFFF", accent: "#FF0033", muted: "#2A2A2A" } },
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#EDEDED" } },
  { id: "night-ember", name: "Night ember", colors: { background: "#141414", textColor: "#FFFFFF", accent: "#FF4D1C", muted: "#2C2C2C" } },
];

// A classic pointer-cursor silhouette (tip at 0,0), scaled to `s`.
function cursor(s: number, fill: string, stroke: string): Graphics {
  const k = s / 28;
  const pts = [0, 0, 0, 24, 6, 18, 10, 28, 14, 26, 10, 16, 18, 16].map((v) => v * k);
  return new Graphics().poly(pts).fill(fill).poly(pts).stroke({ color: stroke, width: Math.max(1, s * 0.04), join: "round" });
}

function scaleFor(aspect: Aspect): number {
  return aspect === "16:9" ? 0.85 : aspect === "9:16" ? 1.05 : 1.0;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#0F0F0F"));
  const accent = str(values.accent, pc("accent", "#FF0033"));
  const muted = pc("muted", "#E5E5E5");
  const isDark = luminance(bg) < 0.5;
  const channel = str(values.channel, "Jima");
  const target = parseTargetNumber(str(values.subscribers, "128000"));

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();
  const cx = size.width / 2;
  const cy = size.height * 0.5;
  const k = size.width * 0.0016 * scaleFor(ctx.aspect); // unit scale (px per "point")

  const group = new Container();
  // Content spans from the channel row (above) to the button; bias down so the
  // whole cluster sits vertically centered in the frame.
  group.position.set(cx, cy + 78 * k);
  root.addChild(group);

  // Channel row (avatar + name) above the button.
  const av = avatar(fonts, { radius: 42 * k, bg: accent, initial: channel.charAt(0).toUpperCase(), textColor: "#FFFFFF" });
  av.position.set(-120 * k, -150 * k);
  group.addChild(av);
  const name = makeText(fonts, { text: channel, role: "display", weight: 700, size: 40 * k, color: textColor, anchor: { x: 0, y: 0.5 } });
  name.position.set(-66 * k, -160 * k);
  group.addChild(name);
  const subsLabel = makeText(fonts, { text: "0 subscribers", role: "body", weight: 500, size: 26 * k, color: isDark ? "#AAAAAA" : "#606060", anchor: { x: 0, y: 0.5 } });
  subsLabel.position.set(-66 * k, -124 * k);
  group.addChild(subsLabel);

  // Subscribe button (red) and Subscribed button (muted) stacked.
  const btnW = 300 * k;
  const btnH = 84 * k;
  const btnY = -20 * k;
  const redBtn = new Container();
  redBtn.position.set(0, btnY);
  redBtn.addChild(makePill(btnW, btnH, accent));
  redBtn.addChild(makeText(fonts, { text: "SUBSCRIBE", role: "display", weight: 700, size: 34 * k, color: "#FFFFFF", anchor: 0.5, letterSpacing: 1 }));
  group.addChild(redBtn);

  const grayBtn = new Container();
  grayBtn.position.set(0, btnY);
  grayBtn.addChild(makePill(btnW, btnH, muted));
  grayBtn.addChild(makeText(fonts, { text: "SUBSCRIBED", role: "display", weight: 700, size: 32 * k, color: isDark ? "#DDDDDD" : "#606060", anchor: 0.5, letterSpacing: 1 }));
  grayBtn.visible = false;
  group.addChild(grayBtn);

  // Bell (appears after subscribe).
  const bell = new Container();
  bell.position.set(btnW / 2 + 70 * k, btnY);
  const bellDisc = new Graphics().circle(0, 0, 46 * k).fill(isDark ? "#2A2A2A" : "#F2F2F2");
  bell.addChild(bellDisc);
  bell.addChild(makeIcon("bell", 52 * k, { color: textColor }));
  bell.scale.set(0);
  group.addChild(bell);

  // Entrance.
  group.alpha = 0;
  redBtn.scale.set(0.9);
  timeline
    .to(group, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outQuad })
    .to(redBtn, { prop: "scale.x", from: 0.9, to: 1, start: 0.0, duration: 0.5, ease: outBack })
    .to(redBtn, { prop: "scale.y", from: 0.9, to: 1, start: 0.0, duration: 0.5, ease: outBack });

  // Cursor moves in and clicks.
  const cur = cursor(70 * k, "#FFFFFF", "#101014");
  const curFrom = { x: btnW * 0.5, y: btnY + 220 * k };
  cur.position.set(curFrom.x, curFrom.y);
  cur.alpha = 0;
  group.addChild(cur);
  const clickAt = 1.15;
  timeline
    .to(cur, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.3, ease: outQuad })
    .to(cur, { prop: "x", from: curFrom.x, to: 24 * k, start: 0.6, duration: 0.55, ease: outExpo })
    .to(cur, { prop: "y", from: curFrom.y, to: btnY + 20 * k, start: 0.6, duration: 0.55, ease: outExpo })
    // click dip
    .to(cur, { prop: "scale.x", from: 1, to: 0.82, start: clickAt, duration: 0.09, ease: outQuad })
    .to(cur, { prop: "scale.y", from: 1, to: 0.82, start: clickAt, duration: 0.09, ease: outQuad })
    .to(cur, { prop: "scale.x", from: 0.82, to: 1, start: clickAt + 0.09, duration: 0.14, ease: outBack })
    .to(cur, { prop: "scale.y", from: 0.82, to: 1, start: clickAt + 0.09, duration: 0.14, ease: outBack })
    .to(cur, { prop: "alpha", from: 1, to: 0, start: 1.7, duration: 0.4, ease: outQuad });

  // Button press feedback + swap to subscribed.
  timeline
    .to(redBtn, { prop: "scale.x", from: 1, to: 0.94, start: clickAt, duration: 0.09, ease: outQuad })
    .to(redBtn, { prop: "scale.y", from: 1, to: 0.94, start: clickAt, duration: 0.09, ease: outQuad });
  timeline.set(redBtn, "visible", false, clickAt + 0.1);
  timeline.set(grayBtn, "visible", true, clickAt + 0.1);
  timeline
    .to(grayBtn, { prop: "scale.x", from: 0.94, to: 1, start: clickAt + 0.1, duration: 0.24, ease: outBack })
    .to(grayBtn, { prop: "scale.y", from: 0.94, to: 1, start: clickAt + 0.1, duration: 0.24, ease: outBack });

  // Bell pops + rings.
  const bellAt = clickAt + 0.18;
  timeline
    .to(bell, { prop: "scale.x", from: 0, to: 1, start: bellAt, duration: 0.5, ease: spring(0.4) })
    .to(bell, { prop: "scale.y", from: 0, to: 1, start: bellAt, duration: 0.5, ease: spring(0.4) });
  const ringSeq: [number, number][] = [[0, 0.35], [0.35, -0.28], [-0.28, 0.2], [0.2, -0.12], [-0.12, 0]];
  ringSeq.forEach(([from, to], i) => {
    timeline.to(bell, { prop: "rotation", from, to, start: bellAt + 0.45 + i * 0.08, duration: 0.08, ease: outQuad });
  });

  // Count-up 0 → target, landing just after the click.
  const countStart = 0.5;
  const countEnd = clickAt + 0.35;
  const update = (t: number) => {
    const u = t <= countStart ? 0 : t >= countEnd ? 1 : (t - countStart) / (countEnd - countStart);
    const eased = 1 - Math.pow(1 - u, 3);
    const n = Math.round(target * eased);
    subsLabel.text = `${groupThousands(n)} subscribers`;
  };

  return { timeline, duration: 3.6, update };
}

export const subscribeBell: TemplateDefinition = {
  id: "subscribe-bell",
  name: "Subscribe Bell",
  tagline: "The subscribe button gets clicked — bell rings, count climbs.",
  category: "social",
  aspects: ["16:9", "1:1", "4:5", "9:16"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  palettes: PALETTES,
  fields: [
    { key: "channel", type: "text", label: "Channel", default: "Jima", maxLength: 24 },
    { key: "subscribers", type: "text", label: "Subscribers", default: "128000", maxLength: 12, help: "Digits — counts up to this." },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Button", default: "", optional: true },
  ],
  build,
};
