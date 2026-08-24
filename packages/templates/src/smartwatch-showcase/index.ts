import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  makeOutBack,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { arcPoints } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

function fitSize(fonts: FontRegistry, text: string, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family("display"), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

// A smartwatch mockup: a rounded-square face shows a watch screen (time +
// activity rings) with a notification banner that slides in and out. The screen
// is always dark (device content); palettes drive the page + the colored band.
const BEZEL = "#16171C";
const SCREEN_BG = "#0A0A0C";
const RING_COLORS = ["#FF3B5C", "#A6FF3C", "#24D1FF"];

const PALETTES: Palette[] = [
  { id: "coral", name: "Coral", colors: { background: "#EEF1F7", accent: "#FF4D6D", textColor: "#101018", chip: "#1C1C22" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7EF", accent: "#12B76A", textColor: "#06301F", chip: "#12241C" } },
  { id: "grape", name: "Grape", colors: { background: "#F1ECFF", accent: "#7C5CFF", textColor: "#241452", chip: "#1E1636" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0E1017", accent: "#5B8CFF", textColor: "#F2F4F8", chip: "#1C2030" } },
];

interface Ring {
  g: Graphics;
  r: number;
  width: number;
  target: number;
  color: string;
  start: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F7"));
  const accent = str(values.accent, pc("accent", "#FF4D6D"));
  const textColor = str(values.textColor, pc("textColor", "#101018"));
  const chip = pc("chip", "#1C1C22");

  const appName = str(values.appName, "Fitness");
  const message = str(values.message, "You closed your Move ring!");
  const showBand = values.showBand !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const cx = w / 2;

  const watchSize = Math.min(minDim * 0.56, h * 0.45, w * 0.52);
  const bandLen = watchSize * 0.34;
  const safeTop = ctx.aspect === "9:16" ? 220 : Math.round(minDim * 0.06);
  const safeBot = ctx.aspect === "9:16" ? 400 : Math.round(minDim * 0.06);
  const cy = safeTop + bandLen + watchSize / 2 + minDim * 0.02;

  // --- Device group (pops in) ---
  const dev = new Container();
  dev.position.set(cx, cy);
  dev.alpha = 0;
  dev.scale.set(0.86);
  root.addChild(dev);
  timeline
    .to(dev, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(dev, { prop: "scale.x", from: 0.86, to: 1, start: 0, duration: 0.6, ease: makeOutBack(1.6) })
    .to(dev, { prop: "scale.y", from: 0.86, to: 1, start: 0, duration: 0.6, ease: makeOutBack(1.6) });

  // Bands (behind the body).
  if (showBand) {
    const bandW = watchSize * 0.62;
    const topBand = new Graphics()
      .moveTo(-bandW / 2, -watchSize / 2)
      .lineTo(bandW / 2, -watchSize / 2)
      .lineTo(bandW * 0.4, -watchSize / 2 - bandLen)
      .lineTo(-bandW * 0.4, -watchSize / 2 - bandLen)
      .closePath()
      .fill(accent);
    const botBand = new Graphics()
      .moveTo(-bandW / 2, watchSize / 2)
      .lineTo(bandW / 2, watchSize / 2)
      .lineTo(bandW * 0.4, watchSize / 2 + bandLen)
      .lineTo(-bandW * 0.4, watchSize / 2 + bandLen)
      .closePath()
      .fill(accent);
    dev.addChild(topBand, botBand);
    dev.addChild(new Graphics().roundRect(-bandW * 0.42, watchSize / 2 + bandLen * 0.5, bandW * 0.84, bandLen * 0.12, bandLen * 0.06).fill({ color: "#000000", alpha: 0.12 }));
  }

  // Body + crown.
  const bodyR = watchSize * 0.28;
  dev.addChild(new Graphics().roundRect(-watchSize / 2, -watchSize / 2 + watchSize * 0.02, watchSize, watchSize, bodyR).fill({ color: "#000000", alpha: 0.2 }));
  dev.addChild(new Graphics().roundRect(-watchSize / 2, -watchSize / 2, watchSize, watchSize, bodyR).fill(BEZEL));
  dev.addChild(new Graphics().roundRect(watchSize / 2 - watchSize * 0.01, -watchSize * 0.09, watchSize * 0.05, watchSize * 0.18, watchSize * 0.025).fill("#2A2C33"));

  // Screen (dark), with a clip mask.
  const bezel = watchSize * 0.08;
  const scr = watchSize - bezel * 2;
  const scrR = bodyR - bezel * 0.6;
  dev.addChild(new Graphics().roundRect(-scr / 2, -scr / 2, scr, scr, scrR).fill(SCREEN_BG));

  const screenC = new Container();
  const mask = new Graphics().roundRect(-scr / 2, -scr / 2, scr, scr, scrR).fill(0xffffff);
  dev.addChild(screenC, mask);
  screenC.mask = mask;

  // Time + weekday.
  const timeNode = makeText(fonts, { text: "9:41", role: "display", weight: 700, size: Math.round(scr * 0.17), color: "#FFFFFF", anchor: 0.5 });
  timeNode.position.set(0, -scr * 0.34);
  timeNode.alpha = 0;
  screenC.addChild(timeNode);
  const dayNode = makeText(fonts, { text: "MON 9", role: "body", weight: 600, size: Math.round(scr * 0.06), color: accent, anchor: 0.5, letterSpacing: 1.5 });
  dayNode.position.set(0, -scr * 0.22);
  dayNode.alpha = 0;
  screenC.addChild(dayNode);
  timeline
    .to(timeNode, { prop: "alpha", from: 0, to: 1, start: 0.45, duration: 0.4, ease: outQuad })
    .to(dayNode, { prop: "alpha", from: 0, to: 0.95, start: 0.5, duration: 0.4, ease: outQuad });

  // Activity rings (fill via update).
  const rings: Ring[] = [];
  const ringCy = scr * 0.12;
  const ringW = scr * 0.058;
  const targets = [0.78, 0.62, 0.92];
  for (let i = 0; i < 3; i++) {
    const r = scr * 0.28 - i * (ringW + scr * 0.018);
    // Track.
    screenC.addChild(
      new Graphics()
        .poly(arcPoints(0, ringCy, r, 0, Math.PI * 2, 48), true)
        .stroke({ color: RING_COLORS[i]!, width: ringW, alpha: 0.18 }),
    );
    const g = new Graphics();
    screenC.addChild(g);
    rings.push({ g, r, width: ringW, target: targets[i]!, color: RING_COLORS[i]!, start: 0.7 + i * 0.1 });
  }

  // Notification banner (slides down from the top, holds, slides away).
  const banner = new Container();
  const bnW = scr * 0.9;
  const bnH = scr * 0.26;
  const bnRestY = -scr / 2 + bnH * 0.62;
  const bnHideY = -scr / 2 - bnH * 0.8;
  banner.position.set(0, bnHideY);
  screenC.addChild(banner);
  banner.addChild(new Graphics().roundRect(-bnW / 2, -bnH / 2, bnW, bnH, bnH * 0.32).fill(chip));
  const iconR = bnH * 0.28;
  banner.addChild(new Graphics().roundRect(-bnW / 2 + bnH * 0.28, -iconR, iconR * 2, iconR * 2, iconR * 0.5).fill(accent));
  const appSize = fitSize(fonts, appName, 700, Math.round(bnH * 0.24), bnW - bnH * 1.4);
  const appNode = makeText(fonts, { text: appName.toUpperCase(), role: "body", weight: 700, size: appSize * 0.72, color: "#FFFFFF", anchor: { x: 0, y: 0.5 }, letterSpacing: 1 });
  appNode.position.set(-bnW / 2 + bnH * 0.9, -bnH * 0.2);
  appNode.alpha = 0.7;
  banner.addChild(appNode);
  const msgSize = fitSize(fonts, message, 600, Math.round(bnH * 0.22), bnW - bnH * 1.4);
  const msgNode = makeText(fonts, { text: message, role: "body", weight: 600, size: msgSize, color: "#FFFFFF", anchor: { x: 0, y: 0.5 } });
  msgNode.position.set(-bnW / 2 + bnH * 0.9, bnH * 0.16);
  banner.addChild(msgNode);
  timeline
    .to(banner, { prop: "y", from: bnHideY, to: bnRestY, start: 1.0, duration: 0.55, ease: outExpo })
    .to(banner, { prop: "y", from: bnRestY, to: bnHideY, start: 2.15, duration: 0.5, ease: outQuad });

  // --- Caption under the watch ---
  const capSize = fitSize(fonts, appName, 700, Math.round(minDim * 0.032), w * 0.7);
  const capY = Math.min(h - safeBot - capSize, cy + watchSize / 2 + bandLen + minDim * 0.04);
  const cap = makeText(fonts, { text: appName, role: "display", weight: 700, size: capSize, color: textColor, anchor: 0.5, align: "center" });
  cap.position.set(cx, capY);
  cap.alpha = 0;
  root.addChild(cap);
  const sub = makeText(fonts, { text: "on your wrist", role: "body", weight: 500, size: Math.round(capSize * 0.5), color: textColor, anchor: 0.5 });
  sub.position.set(cx, capY + capSize * 0.85);
  sub.alpha = 0;
  root.addChild(sub);
  timeline
    .to(cap, { prop: "alpha", from: 0, to: 1, start: 2.5, duration: 0.5, ease: outQuad })
    .to(cap, { prop: "y", from: capY + 14, to: capY, start: 2.5, duration: 0.55, ease: outExpo })
    .to(sub, { prop: "alpha", from: 0, to: 0.7, start: 2.65, duration: 0.5, ease: outQuad });

  const update = (t: number): void => {
    for (const ring of rings) {
      ring.g.clear();
      const p = outCubic(clamp01((t - ring.start) / 1.1));
      const frac = ring.target * p;
      if (frac > 0.002) {
        const a0 = -Math.PI / 2;
        const a1 = a0 + frac * Math.PI * 2;
        const steps = Math.max(6, Math.round(frac * 56));
        ring.g.poly(arcPoints(0, ringCy, ring.r, a0, a1, steps), false).stroke({ color: ring.color, width: ring.width, cap: "round" });
      }
    }
  };

  return { timeline, duration: 4.2, update };
}

export const smartwatchShowcase: TemplateDefinition = {
  id: "smartwatch-showcase",
  name: "Smartwatch Showcase",
  tagline: "A smartwatch face fills its activity rings as a notification slides by.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { appName: "display", message: "body" },
  palettes: PALETTES,
  fields: [
    { key: "appName", type: "text", label: "App name", default: "Fitness", maxLength: 20, shrinkToFit: true },
    { key: "message", type: "text", label: "Notification", default: "You closed your Move ring!", maxLength: 34, shrinkToFit: true },
    { key: "showBand", type: "toggle", label: "Watch band", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
