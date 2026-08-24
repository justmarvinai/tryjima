import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
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

const DEG = Math.PI / 180;

// Decorative gradient pairs for the profile tiles (photo stand-ins) — vibrant
// and fixed, they read as filled photos on both light and dark palettes.
const GRADS: [string, string][] = [
  ["#7C5CFF", "#4457E8"],
  ["#FF5B72", "#FF9A3D"],
  ["#12B886", "#3BC9DB"],
];

/** A rounded tile filled with a two-tone diagonal "gradient" block. */
function gradTile(w: number, h: number, r: number, c1: string, c2: string): Container {
  const c = new Container();
  c.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(c1));
  const holder = new Container();
  const tri = new Graphics().poly([-w / 2, h * 0.18, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2]).fill(c2);
  const mask = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(0xffffff);
  holder.addChild(tri, mask);
  tri.mask = mask;
  c.addChild(holder);
  return c;
}

// A pinned-post indicator on a 3-tile profile row: the tiles pop in, then a
// "Pinned" ribbon drops onto the first tile. The full-frame `bg` rect carries
// the background field; tiles are decorative gradient blocks.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#12141A", accent: "#FF3B30" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", textColor: "#FFFFFF", accent: "#FFB020" } },
  { id: "blush", name: "Blush", colors: { background: "#FFF1F5", textColor: "#2A0A18", accent: "#FF2E9E" } },
  { id: "mint", name: "Mint", colors: { background: "#EAF7EE", textColor: "#08221A", accent: "#17A34A" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#12141A"));
  const accent = str(values.accent, pc("accent", "#FF3B30"));
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const label = str(values.label, "Pinned");
  const handle = str(values.handle, "@studio.jima");
  const showRibbon = on(values.showRibbon);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry: header row + a 3-tile row, centered in the safe area ---
  const tileGap = Math.round(minDim * 0.02);
  const tileW = Math.min((safe.width - tileGap * 2) / 3, minDim * 0.34);
  const tileH = tileW;
  const tileR = Math.round(tileW * 0.09);
  const rowW = tileW * 3 + tileGap * 2;
  const rowLeft = cx - rowW / 2;

  const avR = Math.round(minDim * 0.032);
  const handleSize = fitSize(fonts, handle, "display", 700, Math.round(minDim * 0.036), rowW - avR * 2 - minDim * 0.03);
  const headerH = avR * 2;
  const gapHR = Math.round(minDim * 0.045);
  const blockH = headerH + gapHR + tileH;
  const top = safe.y + Math.max(0, (safe.height - blockH) / 2);

  // --- Header (avatar dot + handle), left-aligned to the tile row ---
  const headerCy = top + headerH / 2;
  const header = new Container();
  header.alpha = 0;
  root.addChild(header);
  const av = new Container();
  av.position.set(rowLeft + avR, headerCy);
  av.addChild(new Graphics().circle(0, 0, avR).fill(GRADS[0]![0]));
  av.addChild(makeIcon("user", avR * 1.2, { color: "#FFFFFF" }));
  header.addChild(av);
  if (handle.length > 0) {
    const handleText = makeText(fonts, { text: handle, role: "display", weight: 700, size: handleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    handleText.position.set(rowLeft + avR * 2 + minDim * 0.02, headerCy);
    header.addChild(handleText);
  }
  timeline.to(header, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad });

  // --- The 3 tiles ---
  const rowCy = top + headerH + gapHR + tileH / 2;
  let firstTileCx = rowLeft + tileW / 2;
  for (let i = 0; i < 3; i++) {
    const g = GRADS[i % GRADS.length]!;
    const tile = gradTile(tileW, tileH, tileR, g[0], g[1]);
    const tcx = rowLeft + i * (tileW + tileGap) + tileW / 2;
    if (i === 0) firstTileCx = tcx;
    tile.position.set(tcx, rowCy);
    tile.scale.set(0);
    tile.alpha = 0;
    root.addChild(tile);
    const start = 0.35 + i * 0.12;
    timeline
      .to(tile, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(tile, { prop: "scale.x", from: 0, to: 1, start, duration: 0.6, ease: spring(0.5) })
      .to(tile, { prop: "scale.y", from: 0, to: 1, start, duration: 0.6, ease: spring(0.5) });
  }

  // --- "Pinned" ribbon drops onto the first tile's top-left corner ---
  if (showRibbon) {
    const ribH = Math.round(tileH * 0.24);
    const pinR = ribH * 0.34;
    const ribSize = fitSize(fonts, label, "body", 700, Math.round(ribH * 0.44), tileW * 0.9);
    const ribTextW = fonts.measure(label, { family: fonts.family("body"), weight: 700, size: ribSize });
    const ribW = pinR * 2 + ribH * 0.34 + ribTextW + ribH * 0.7;

    const ribbon = new Container();
    const restX = firstTileCx - tileW / 2 + ribW / 2 + tileW * 0.06;
    const restY = rowCy - tileH / 2 + ribH / 2 + tileH * 0.06;
    ribbon.position.set(restX, restY - minDim * 0.5);
    ribbon.alpha = 0;
    ribbon.rotation = -10 * DEG;
    root.addChild(ribbon);

    const e = Math.round(ribH * 0.08);
    ribbon.addChild(new Graphics().roundRect(-ribW / 2 - e, -ribH / 2 - e + e * 1.6, ribW + e * 2, ribH + e * 2, ribH / 2 + e).fill({ color: "#000000", alpha: 0.2 }));
    ribbon.addChild(new Graphics().roundRect(-ribW / 2, -ribH / 2, ribW, ribH, ribH / 2).fill(accent));
    const pin = makeIcon("pin", pinR * 2, { color: onAccent, holeColor: accent });
    pin.position.set(-ribW / 2 + ribH * 0.42 + pinR, 0);
    ribbon.addChild(pin);
    const ribText = makeText(fonts, { text: label, role: "body", weight: 700, size: ribSize, color: onAccent, anchor: { x: 0, y: 0.5 } });
    ribText.position.set(-ribW / 2 + ribH * 0.42 + pinR * 2 + ribH * 0.34, 0);
    ribbon.addChild(ribText);

    const DROP = 1.05;
    timeline
      .to(ribbon, { prop: "alpha", from: 0, to: 1, start: DROP, duration: 0.2, ease: outQuad })
      .to(ribbon, { prop: "y", from: restY - minDim * 0.5, to: restY, start: DROP, duration: 0.6, ease: spring(0.44) })
      .to(ribbon, { prop: "rotation", from: -10 * DEG, to: -4 * DEG, start: DROP, duration: 0.7, ease: outExpo });
  }

  return { timeline, duration: 4.0 };
}

export const pinnedPost: TemplateDefinition = {
  id: "pinned-post",
  name: "Pinned Post",
  tagline: "Profile tiles pop into a row, then a Pinned ribbon drops onto the first.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { handle: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Ribbon text", default: "Pinned", maxLength: 16, shrinkToFit: true },
    { key: "handle", type: "text", label: "Handle", default: "@studio.jima", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "showRibbon", type: "toggle", label: "Pinned ribbon", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Ribbon color", default: "", optional: true },
  ],
  build,
};
