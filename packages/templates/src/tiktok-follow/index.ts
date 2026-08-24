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
import { avatar, pointerCursor } from "../shared/ui";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
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
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FE2C55", avatarBg: "#111318", onAccent: "#FFFFFF" } },
  { id: "dark", name: "Dark", colors: { background: "#0D0D11", textColor: "#FFFFFF", accent: "#FE2C55", avatarBg: "#26262C", onAccent: "#FFFFFF" } },
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", avatarBg: "#101014", onAccent: "#FFFFFF" } },
  { id: "night-ember", name: "Night ember", colors: { background: "#141414", textColor: "#FFFFFF", accent: "#FF4D1C", avatarBg: "#2C2C2C", onAccent: "#FFFFFF" } },
];

function avFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.17 : 0.2;
}
function cyFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.42 : 0.43;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FE2C55"));
  const avatarBg = pc("avatarBg", "#111318");
  const onAccent = pc("onAccent", "#FFFFFF");
  const isDark = luminance(bg) < 0.5;
  const labelColor = isDark ? "#AAB0B8" : "#5B6169";
  const username = str(values.username, "@jima.studio");
  const label = str(values.label, "Follow for more");
  const initial = ((/[0-9a-z]/i.exec(username)?.[0]) ?? "?").toUpperCase();
  const showSparkles = values.sparkles !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();
  const cx = size.width / 2;
  const minDim = Math.min(size.width, size.height);
  const avR = minDim * avFrac(ctx.aspect);
  const cy = size.height * cyFrac(ctx.aspect);
  const badgeR = avR * 0.34;
  const badgeCY = cy + avR;
  const tapAt = 1.0;

  // Round avatar with the username initial.
  const av = avatar(fonts, { radius: avR, bg: avatarBg, initial, textColor: onAccent });
  av.position.set(cx, cy);
  av.scale.set(0);
  root.addChild(av);
  timeline
    .to(av, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) })
    .to(av, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) });

  // Follow badge overlapping the avatar's bottom edge: plus → check on tap.
  const badge = new Container();
  badge.position.set(cx, badgeCY);
  badge.addChild(new Graphics().circle(0, 0, badgeR + minDim * 0.013).fill(bg));
  badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
  const plusC = new Container();
  plusC.addChild(makeIcon("plus", badgeR * 1.05, { color: onAccent }));
  const checkC = new Container();
  checkC.addChild(makeIcon("check", badgeR * 1.25, { color: onAccent }));
  checkC.visible = false;
  checkC.scale.set(0.4);
  badge.addChild(plusC, checkC);
  badge.scale.set(0);
  root.addChild(badge);
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.45, duration: 0.55, ease: spring(0.45) })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.45, duration: 0.55, ease: spring(0.45) })
    .to(badge, { prop: "scale.x", from: 1, to: 0.78, start: tapAt, duration: 0.09, ease: outQuad })
    .to(badge, { prop: "scale.y", from: 1, to: 0.78, start: tapAt, duration: 0.09, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 0.78, to: 1, start: tapAt + 0.09, duration: 0.5, ease: spring(0.3) })
    .to(badge, { prop: "scale.y", from: 0.78, to: 1, start: tapAt + 0.09, duration: 0.5, ease: spring(0.3) });
  timeline.set(plusC, "visible", false, tapAt + 0.04);
  timeline.set(checkC, "visible", true, tapAt + 0.04);
  timeline
    .to(checkC, { prop: "scale.x", from: 0.4, to: 1, start: tapAt + 0.04, duration: 0.4, ease: outBack })
    .to(checkC, { prop: "scale.y", from: 0.4, to: 1, start: tapAt + 0.04, duration: 0.4, ease: outBack });

  // Username + optional label below the avatar.
  const unameSize = Math.round(minDim * 0.05);
  const unameY = cy + avR + badgeR + unameSize * 1.2;
  const unameText = makeText(fonts, { text: username, role: "display", weight: 700, size: unameSize, color: textColor, anchor: 0.5, align: "center" });
  unameText.position.set(cx, unameY);
  unameText.alpha = 0;
  root.addChild(unameText);
  timeline
    .to(unameText, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.45, ease: outQuad })
    .to(unameText, { prop: "y", from: unameY + 16, to: unameY, start: 0.55, duration: 0.55, ease: outExpo });

  if (label.length > 0) {
    const labelSize = Math.round(unameSize * 0.62);
    const labelY = unameY + unameSize * 0.9;
    const labelText = makeText(fonts, { text: label, role: "body", weight: 500, size: labelSize, color: labelColor, anchor: 0.5, align: "center" });
    labelText.position.set(cx, labelY);
    labelText.alpha = 0;
    root.addChild(labelText);
    timeline
      .to(labelText, { prop: "alpha", from: 0, to: 1, start: 0.75, duration: 0.45, ease: outQuad })
      .to(labelText, { prop: "y", from: labelY + 12, to: labelY, start: 0.75, duration: 0.55, ease: outExpo });
  }

  // Pointer taps the badge.
  const cur = pointerCursor(minDim * 0.085, "#FFFFFF", "#101014");
  const curFrom = { x: cx + avR * 0.9, y: badgeCY + avR * 1.1 };
  const curTo = { x: cx + badgeR * 0.1, y: badgeCY + badgeR * 0.15 };
  cur.position.set(curFrom.x, curFrom.y);
  cur.alpha = 0;
  root.addChild(cur);
  timeline
    .to(cur, { prop: "alpha", from: 0, to: 1, start: 0.4, duration: 0.3, ease: outQuad })
    .to(cur, { prop: "x", from: curFrom.x, to: curTo.x, start: 0.4, duration: 0.6, ease: outExpo })
    .to(cur, { prop: "y", from: curFrom.y, to: curTo.y, start: 0.4, duration: 0.6, ease: outExpo })
    .to(cur, { prop: "scale.x", from: 1, to: 0.82, start: tapAt, duration: 0.09, ease: outQuad })
    .to(cur, { prop: "scale.y", from: 1, to: 0.82, start: tapAt, duration: 0.09, ease: outQuad })
    .to(cur, { prop: "scale.x", from: 0.82, to: 1, start: tapAt + 0.09, duration: 0.16, ease: outBack })
    .to(cur, { prop: "scale.y", from: 0.82, to: 1, start: tapAt + 0.09, duration: 0.16, ease: outBack })
    .to(cur, { prop: "alpha", from: 1, to: 0, start: tapAt + 0.45, duration: 0.35, ease: outQuad });

  // Little hearts float up from the badge on the follow.
  const hearts: { g: Graphics; vx: number; vy: number }[] = [];
  if (showSparkles) {
    for (let i = 0; i < 10; i++) {
      const hs = minDim * rng.range(0.03, 0.05);
      const g = makeIcon("heart", hs, { color: rng.pick([accent, "#FF8FA3"]) });
      g.position.set(cx, badgeCY);
      g.visible = false;
      root.addChild(g);
      const ang = -Math.PI / 2 + rng.range(-0.6, 0.6);
      const speed = rng.range(0.5, 0.9) * minDim;
      hearts.push({ g, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed });
    }
  }

  const BURST = tapAt + 0.02;
  const LIFE = 1.2;
  const GRAV = 0.6 * minDim;
  const update = (t: number) => {
    for (const h of hearts) {
      const tau = t - BURST;
      if (tau < 0 || tau > LIFE) {
        h.g.visible = false;
        continue;
      }
      h.g.visible = true;
      h.g.x = cx + h.vx * tau;
      h.g.y = badgeCY + h.vy * tau + 0.5 * GRAV * tau * tau;
      h.g.alpha = 1 - clamp01(tau / LIFE);
      const sc = 0.6 + 0.4 * clamp01(tau / 0.2);
      h.g.scale.set(sc);
    }
  };

  return { timeline, duration: 3.4, update };
}

export const tiktokFollow: TemplateDefinition = {
  id: "tiktok-follow",
  name: "Follow Pop",
  tagline: "The follow badge gets tapped — it flips to a check as hearts rise.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.0,
  palettes: PALETTES,
  fields: [
    { key: "username", type: "text", label: "Username", default: "@jima.studio", maxLength: 24 },
    { key: "label", type: "text", label: "Label", default: "Follow for more", maxLength: 30, optional: true },
    { key: "sparkles", type: "toggle", label: "Sparkles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
