import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutQuad,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A bright diagonal light-leak sweeps across an off-white stage and the title
// fades in behind it. Backgrounds stay light; the accent only tints the sweep
// and a hairline under the title, so the held end frame is dark-on-light.
const PALETTES: Palette[] = [
  { id: "dawn", name: "Dawn", colors: { background: "#FBF8F3", textColor: "#171319", accent: "#FF7A3D" } },
  { id: "sky", name: "Sky", colors: { background: "#F1F6FD", textColor: "#0E2140", accent: "#2E7DF6" } },
  { id: "orchid", name: "Orchid", colors: { background: "#FBF2FA", textColor: "#25102A", accent: "#D63FC6" } },
  { id: "lime", name: "Lime", colors: { background: "#F6FBEE", textColor: "#1C2A0B", accent: "#6FB80E" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.082 : aspect === "9:16" ? 0.112 : 0.1;
}

const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF8F3"));
  const textColor = str(values.textColor, pc("textColor", "#171319"));
  const accent = str(values.accent, pc("accent", "#FF7A3D"));
  const title = str(values.title, "Bright Ideas");
  const subtitle = str(values.subtitle, "in a flash");
  const showFlare = on(values.showFlare);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Content (title + subtitle), revealed behind the sweep ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.6 : 0.84);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.3);
  const lineGap = subSize * 0.95;
  const ruleGap = subSize * 0.7;
  const ruleH = Math.max(3, minDim * 0.006);
  const totalH = titleSize + (hasSub ? ruleGap + ruleH + lineGap * 0.4 + subSize : ruleGap + ruleH);

  const content = new Container();
  content.position.set(cx, centerY);
  root.addChild(content);

  const titleY = -totalH / 2 + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, titleY);
  titleText.alpha = 0;
  content.addChild(titleText);

  // Hairline accent rule under the title (keeps a touch of brand at the end).
  const ruleW = Math.min(maxW, minDim * 0.16);
  const ruleY = titleY + titleSize * 0.62 + ruleGap;
  const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
  rule.position.set(0, ruleY);
  rule.scale.set(0, 1);
  content.addChild(rule);

  const revealAt = showFlare ? 0.62 : 0.2;
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: revealAt, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 16, to: titleY, start: revealAt, duration: 0.6, ease: outQuint })
    .to(rule, { prop: "scale.x", from: 0, to: 1, start: revealAt + 0.2, duration: 0.5, ease: outQuint });

  if (hasSub) {
    const subY = ruleY + ruleH + lineGap * 0.5 + subSize * 0.5;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subText.position.set(0, subY + 12);
    subText.alpha = 0;
    content.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.82, start: revealAt + 0.35, duration: 0.5, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 12, to: subY, start: revealAt + 0.35, duration: 0.55, ease: outQuint });
  }

  // --- The diagonal light sweep (in front of the title) ---
  if (showFlare) {
    const flare = new Container();
    flare.position.set(cx, centerY);
    flare.rotation = -0.3;
    flare.alpha = 0;
    root.addChild(flare);

    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = accent;
    glow.width = minDim * 0.6;
    glow.height = maxDim * 1.7;
    glow.alpha = 0.55;
    flare.addChild(glow);

    const streakLen = maxDim * 1.5;
    for (const s of [{ off: -minDim * 0.02, th: minDim * 0.02, a: 0.85 }, { off: minDim * 0.05, th: minDim * 0.01, a: 0.5 }]) {
      const streak = new Graphics().roundRect(s.off - s.th / 2, -streakLen / 2, s.th, streakLen, s.th / 2).fill({ color: "#FFFFFF", alpha: s.a });
      flare.addChild(streak);
    }

    // Cross glint at the bright core.
    const glint = new Container();
    const gl = minDim * 0.16;
    const gt = Math.max(2, minDim * 0.006);
    glint.addChild(new Graphics().roundRect(-gt / 2, -gl, gt, gl * 2, gt / 2).fill("#FFFFFF"));
    glint.addChild(new Graphics().roundRect(-gl, -gt / 2, gl * 2, gt, gt / 2).fill("#FFFFFF"));
    glint.scale.set(0);
    flare.addChild(glint);

    const sweepStart = 0.3;
    const sweepDur = 1.0;
    timeline
      .to(flare, { prop: "x", from: cx - w * 0.85, to: cx + w * 0.85, start: sweepStart, duration: sweepDur, ease: inOutQuad })
      .to(flare, { prop: "alpha", from: 0, to: 1, start: sweepStart, duration: 0.3, ease: outQuad })
      .to(flare, { prop: "alpha", from: 1, to: 0, start: sweepStart + sweepDur * 0.55, duration: sweepDur * 0.45, ease: outQuad })
      .to(glint, { prop: "scale.x", from: 0, to: 1, start: sweepStart + sweepDur * 0.35, duration: 0.18, ease: outQuad })
      .to(glint, { prop: "scale.x", from: 1, to: 0, start: sweepStart + sweepDur * 0.53, duration: 0.24, ease: outQuad })
      .to(glint, { prop: "scale.y", from: 0, to: 1, start: sweepStart + sweepDur * 0.35, duration: 0.18, ease: outQuad })
      .to(glint, { prop: "scale.y", from: 1, to: 0, start: sweepStart + sweepDur * 0.53, duration: 0.24, ease: outQuad });
  }

  return { timeline, duration: DURATION };
}

export const lightSweep: TemplateDefinition = {
  id: "light-sweep",
  name: "Light Sweep",
  tagline: "A bright diagonal light-leak sweeps across and the title fades in.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Bright Ideas", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "in a flash", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showFlare", type: "toggle", label: "Light flare", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
