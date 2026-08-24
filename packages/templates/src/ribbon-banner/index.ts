import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  safeRect,
  safeCenter,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
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

// --- Deterministic hex mixing (pure) — fold/end shades derive from the ribbon color.
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full.length === 6 ? full : "ffffff", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const toHex = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${toHex(ca.r + (cb.r - ca.r) * t)}${toHex(ca.g + (cb.g - ca.g) * t)}${toHex(ca.b + (cb.b - ca.b) * t)}`;
}

// A physical ribbon: center panel, folded ends in darker shades, swallowtail
// tips. The brand name sits on the ribbon (onRibbon vs ribbonColor ≥ 4.5:1);
// the kicker sits on the background (textColor vs background ≥ 4.5:1).
const PALETTES: Palette[] = [
  { id: "emerald", name: "Emerald", colors: { background: "#F3F7F4", textColor: "#10241A", ribbonColor: "#0A6B3A", onRibbon: "#FFFFFF", accent: "#0A6B3A" } },
  { id: "crimson", name: "Crimson", colors: { background: "#FBF3EE", textColor: "#341008", ribbonColor: "#A31D2B", onRibbon: "#FFFFFF", accent: "#A31D2B" } },
  { id: "navy-gold", name: "Navy gold", colors: { background: "#111A2C", textColor: "#F0EFE6", ribbonColor: "#D8B45A", onRibbon: "#2A1F06", accent: "#D8B45A" } },
  { id: "royal", name: "Royal", colors: { background: "#EEF1FB", textColor: "#131C4D", ribbonColor: "#2B3FBF", onRibbon: "#FFFFFF", accent: "#2B3FBF" } },
];

const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3F7F4"));
  const textColor = str(values.textColor, pc("textColor", "#10241A"));
  const ribbonColor = str(values.ribbonColor, pc("ribbonColor", "#0A6B3A"));
  const onRibbon = pc("onRibbon", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#0A6B3A"));
  const endColor = mixHex(ribbonColor, "#000000", 0.22);
  const foldColor = mixHex(ribbonColor, "#000000", 0.45);

  const name = str(values.name, "Aurora & Co");
  const kicker = str(values.kicker, "SINCE MMXVI").toUpperCase();
  const showKicker = values.showKicker !== false;
  const showFlourish = values.showFlourish !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const center = safeCenter(ctx.aspect);
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const H = minDim * 0.135;
  const W = Math.min(zone.width * 0.8, H * 6.8);
  const endOut = H * 0.8;
  const dy = H * 0.3; // how much lower the folded ends sit
  const notch = H * 0.36; // swallowtail depth

  const ribbonC = new Container();
  ribbonC.position.set(center.x, center.y);
  root.addChild(ribbonC);
  const assembly = new Container(); // wave target (scale.y wobble)
  ribbonC.addChild(assembly);

  // --- Folded ends (behind the panel; rotate slightly for the end flick) ---
  const xo = H * 0.2 + endOut; // outer edge, relative to the end pivot
  const endR = new Container();
  endR.position.set(W / 2 - H * 0.2, dy);
  endR.addChild(
    new Graphics()
      .poly([-H * 0.1, -H / 2, xo, -H / 2, xo - notch, 0, xo, H / 2, -H * 0.1, H / 2])
      .fill(endColor),
  );
  const endL = new Container();
  endL.position.set(-(W / 2 - H * 0.2), dy);
  endL.addChild(
    new Graphics()
      .poly([H * 0.1, -H / 2, -xo, -H / 2, -xo + notch, 0, -xo, H / 2, H * 0.1, H / 2])
      .fill(endColor),
  );
  assembly.addChild(endL, endR);

  // --- Fold shading triangles under the panel corners ---
  const folds = new Graphics()
    .poly([W / 2 - H * 0.32, H / 2, W / 2, H / 2, W / 2, H / 2 + dy * 0.92])
    .fill(foldColor)
    .poly([-(W / 2 - H * 0.32), H / 2, -W / 2, H / 2, -W / 2, H / 2 + dy * 0.92])
    .fill(foldColor);
  assembly.addChild(folds);

  // --- Center panel with a soft top highlight and bottom shade (cloth depth) ---
  const panel = new Graphics()
    .rect(-W / 2, -H / 2, W, H)
    .fill(ribbonColor)
    .rect(-W / 2, -H / 2, W, H * 0.1)
    .fill({ color: "#FFFFFF", alpha: 0.14 })
    .rect(-W / 2, H / 2 - H * 0.12, W, H * 0.12)
    .fill({ color: foldColor, alpha: 0.28 });
  assembly.addChild(panel);

  // --- Brand name on the ribbon ---
  const nameSize = fitSize(fonts, name, "display", 700, Math.round(H * 0.4), W - H * 1.2);
  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 700,
    size: nameSize,
    color: onRibbon,
    anchor: 0.5,
    letterSpacing: 1,
  });
  nameText.position.set(0, -H * 0.02);
  nameText.alpha = 0;
  assembly.addChild(nameText);

  // --- Unfurl: a centered mask grows outward while the ribbon waves once ---
  const maskW = W + 2 * endOut + H * 0.6;
  const maskH = H * 3.2;
  const maskRect = new Graphics().rect(-maskW / 2, -maskH / 2, maskW, maskH).fill("#FFFFFF");
  maskRect.position.set(center.x, center.y + dy * 0.5);
  root.addChild(maskRect);
  ribbonC.mask = maskRect;
  timeline
    .to(maskRect, { prop: "scale.x", from: 0.03, to: 1, start: 0.12, duration: 0.85, ease: outQuint })
    .to(assembly, { prop: "scale.y", from: 1, to: 1.06, start: 0.3, duration: 0.3, ease: outQuad })
    .to(assembly, { prop: "scale.y", from: 1.06, to: 0.985, start: 0.6, duration: 0.25, ease: outQuad })
    .to(assembly, { prop: "scale.y", from: 0.985, to: 1, start: 0.85, duration: 0.4, ease: outQuad });

  // Ends flick once as the unfurl lands.
  timeline
    .to(endR, { prop: "rotation", from: 0, to: -0.05, start: 1.0, duration: 0.18, ease: outQuad })
    .to(endR, { prop: "rotation", from: -0.05, to: 0, start: 1.18, duration: 0.55, ease: makeOutBack(2.6) })
    .to(endL, { prop: "rotation", from: 0, to: 0.05, start: 1.06, duration: 0.18, ease: outQuad })
    .to(endL, { prop: "rotation", from: 0.05, to: 0, start: 1.24, duration: 0.55, ease: makeOutBack(2.6) });

  // Name settles onto the panel.
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 1.15, duration: 0.45, ease: outQuad })
    .to(nameText, { prop: "scale.x", from: 0.94, to: 1, start: 1.15, duration: 0.55, ease: outExpo })
    .to(nameText, { prop: "scale.y", from: 0.94, to: 1, start: 1.15, duration: 0.55, ease: outExpo });

  // --- Kicker above the ribbon ---
  if (showKicker) {
    const kickSize = fitSize(fonts, kicker, "body", 600, Math.round(H * 0.185), W * 0.9);
    const kickY = center.y - H * 0.5 - H * 0.42;
    const kick = makeText(fonts, {
      text: kicker,
      role: "body",
      weight: 600,
      size: kickSize,
      color: textColor,
      anchor: { x: 0.5, y: 1 },
      letterSpacing: 3,
    });
    kick.position.set(center.x, kickY);
    kick.alpha = 0;
    root.addChild(kick);
    timeline
      .to(kick, { prop: "alpha", from: 0, to: 0.9, start: 1.5, duration: 0.4, ease: outQuad })
      .to(kick, { prop: "y", from: kickY + 10, to: kickY, start: 1.5, duration: 0.45, ease: outQuint });
  }

  // --- Flourish lines + diamond below the ribbon ---
  if (showFlourish) {
    const fy = center.y + H * 0.5 + dy + H * 0.34;
    const lineLen = W * 0.16;
    const lineH = Math.max(2, H * 0.028);
    const gap = H * 0.16;
    [-1, 1].forEach((dir) => {
      const lineC = new Container();
      lineC.position.set(center.x + dir * gap, fy);
      lineC.scale.x = 0;
      lineC.addChild(
        new Graphics().roundRect(dir === 1 ? 0 : -lineLen, -lineH / 2, lineLen, lineH, lineH / 2).fill(accent),
      );
      root.addChild(lineC);
      timeline.to(lineC, { prop: "scale.x", from: 0, to: 1, start: 1.65, duration: 0.5, ease: outExpo });
    });
    const dia = H * 0.075;
    const diamond = new Graphics().poly([0, -dia, dia, 0, 0, dia, -dia, 0]).fill(accent);
    diamond.position.set(center.x, fy);
    diamond.scale.set(0);
    root.addChild(diamond);
    timeline
      .to(diamond, { prop: "scale.x", from: 0, to: 1, start: 1.85, duration: 0.4, ease: makeOutBack(2.2) })
      .to(diamond, { prop: "scale.y", from: 0, to: 1, start: 1.85, duration: 0.4, ease: makeOutBack(2.2) });
  }

  return { timeline, duration: DURATION };
}

export const ribbonBanner: TemplateDefinition = {
  id: "ribbon-banner",
  name: "Ribbon Banner",
  tagline: "A folded ribbon unfurls across the frame and your brand name settles on it.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { name: "display" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Brand name", default: "Aurora & Co", maxLength: 24, shrinkToFit: true },
    { key: "kicker", type: "text", label: "Kicker", default: "SINCE MMXVI", maxLength: 24, shrinkToFit: true },
    { key: "showKicker", type: "toggle", label: "Kicker line", default: true },
    { key: "showFlourish", type: "toggle", label: "Flourish lines", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "ribbonColor", type: "color", label: "Ribbon", default: "", optional: true },
    { key: "textColor", type: "color", label: "Kicker text", default: "", optional: true },
    { key: "accent", type: "color", label: "Flourish", default: "", optional: true },
  ],
  build,
};
