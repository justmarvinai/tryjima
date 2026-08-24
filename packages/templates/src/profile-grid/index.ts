import { Container, Graphics, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  inOutCubic,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

// Profile Grid — a considered account page: profile header (avatar, handle,
// stats) with the 3×3 feed underneath. Tiles arrive on a diagonal wave, each
// fading and rising on a long expo curve, so the grid fills like a soft sweep
// rather than a burst. The header framing is the point (vs. a bare photo grid).

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
const inkOn = (hex: string): string => (luminance(hex) < 0.56 ? "#FFFFFF" : "#14161B");

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
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

function initialOf(raw: string): string {
  const t = raw.trim().replace(/^@+/, "");
  const c = t.charAt(0);
  return c.length > 0 ? c.toUpperCase() : "?";
}

// Muted, editorial photo tones for the feed tiles — content, not chrome, so they
// stay constant across palettes (like phone-scroll's photo blocks).
const TILE_GRADS: [string, string][] = [
  ["#C9D5E2", "#9FB3C8"],
  ["#E4D6C8", "#C4A98F"],
  ["#CADDD3", "#9CBFAF"],
  ["#D9D0E5", "#B3A3CB"],
  ["#E6D3CC", "#C79E93"],
  ["#CCDADD", "#9FB6BB"],
  ["#DCD8CB", "#B6AE99"],
  ["#C6D2D8", "#9AAAB6"],
];

const PALETTES: Palette[] = [
  { id: "porcelain", name: "Porcelain", colors: { background: "#FBFAF9", textColor: "#16181D", accent: "#1F6F5C", avatarBg: "#2B3038" } },
  { id: "mist", name: "Mist", colors: { background: "#EEF1F6", textColor: "#101722", accent: "#2A55A5", avatarBg: "#1E2A3D" } },
  { id: "sand", name: "Sand", colors: { background: "#F7F2EA", textColor: "#241D15", accent: "#9C4D1C", avatarBg: "#3A2E23" } },
  { id: "ink", name: "Ink", colors: { background: "#101318", textColor: "#F3F5F8", accent: "#86D3B6", avatarBg: "#39414E" } },
];

const DEFAULT_STATS = ["128|Posts", "24.6K|Followers", "312|Following"];

// Column rhythm, as fractions of the column width (the 3×3 grid is exactly 1.0).
const F_HEADER = 0.21;
const F_G1 = 0.075;
const F_STATS = 0.115;
const F_G2 = 0.07;
const F_RULE = 0.0024;
const F_G3 = 0.062;
const F_GRID = 1.0;

const AVATAR_AT = 0.12;
const HANDLE_AT = 0.24;
const NAME_AT = 0.34;
const STATS_AT = 0.5;
const STATS_STAGGER = 0.1;
const RULE_AT = 0.82;
const TILE_AT = 1.05;
const TILE_STAGGER = 0.085;
const DURATION = 4.2;

function linGrad(c0: string, c1: string): FillGradient {
  return new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: c0 },
      { offset: 1, color: c1 },
    ],
    textureSpace: "local",
  });
}

interface Stat {
  value: string;
  label: string;
}

function parseStats(values: Values): Stat[] {
  return asList(values.stats, DEFAULT_STATS)
    .slice(0, 3)
    .map((raw) => {
      const parts = raw.split("|").map((s) => s.trim());
      const value = parts[0] ?? "";
      const label = parts[1] ?? "";
      return { value: value.length > 0 ? value : "—", label };
    });
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBFAF9"));
  const textColor = str(values.textColor, pc("textColor", "#16181D"));
  const accent = str(values.accent, pc("accent", "#1F6F5C"));
  const avatarBg = pc("avatarBg", "#2B3038");

  const handle = str(values.handle, "@northlight.studio");
  const name = str(values.name, "Design & motion, Rotterdam");
  const stats = parseStats(values);
  const showStats = on(values.showStats) && stats.length > 0;
  const showRule = on(values.showRule);
  const showRing = on(values.showRing);
  const showMarks = on(values.showTileMarks);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // Seeded tile tones, drawn up-front so toggles never reshuffle the stream.
  const grads: [string, string][] = [];
  for (let i = 0; i < 9; i++) grads.push(rng.pick(TILE_GRADS));

  // --- Column metrics: everything scales with one column width ---
  let frac = F_HEADER;
  if (showStats) frac += F_G1 + F_STATS;
  if (showRule) frac += F_G2 + F_RULE;
  frac += F_G3 + F_GRID;

  const colW = Math.min(Math.min(safe.width, minDim * 0.94), (safe.height * 0.98) / frac);
  const left = cx - colW / 2;
  let y = safe.y + (safe.height - frac * colW) / 2;

  // --- Header: avatar + handle + one-line bio ---
  const avatarR = colW * 0.105;
  const headCy = y + avatarR;
  const av = new Container();
  if (showRing) {
    const rw = Math.max(2, avatarR * 0.075);
    av.addChild(new Graphics().circle(0, 0, avatarR + rw * 2).stroke({ color: accent, width: rw }));
  }
  av.addChild(new Graphics().circle(0, 0, avatarR).fill(avatarBg));
  av.addChild(
    makeText(fonts, {
      text: initialOf(handle),
      role: "display",
      weight: 700,
      size: Math.round(avatarR * 0.94),
      color: inkOn(avatarBg),
      anchor: 0.5,
    }),
  );
  av.position.set(left + avatarR, headCy);
  av.alpha = 0;
  av.scale.set(0.87);
  root.addChild(av);
  timeline
    .to(av, { prop: "alpha", from: 0, to: 1, start: AVATAR_AT, duration: 0.55, ease: outQuad })
    .to(av, { prop: "scale.x", from: 0.87, to: 1, start: AVATAR_AT, duration: 1.0, ease: outExpo })
    .to(av, { prop: "scale.y", from: 0.87, to: 1, start: AVATAR_AT, duration: 1.0, ease: outExpo });

  const textLeft = left + avatarR * 2 + colW * 0.055;
  const textMaxW = colW - (textLeft - left);
  const lineGap = colW * 0.033;

  const handleSize = fitSize(fonts, handle, "display", 700, Math.round(colW * 0.062), textMaxW);
  const handleY = headCy - lineGap;
  const handleText = makeText(fonts, { text: handle, role: "display", weight: 700, size: handleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  handleText.position.set(textLeft, handleY);
  handleText.alpha = 0;
  root.addChild(handleText);
  timeline
    .to(handleText, { prop: "alpha", from: 0, to: 1, start: HANDLE_AT, duration: 0.55, ease: outQuad })
    .to(handleText, { prop: "y", from: handleY + colW * 0.016, to: handleY, start: HANDLE_AT, duration: 0.95, ease: outExpo });

  if (name.length > 0) {
    const nameSize = fitSize(fonts, name, "body", 500, Math.round(colW * 0.041), textMaxW);
    const nameY = headCy + lineGap + nameSize * 0.18;
    const nameText = makeText(fonts, { text: name, role: "body", weight: 500, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    nameText.position.set(textLeft, nameY);
    nameText.alpha = 0;
    root.addChild(nameText);
    timeline
      .to(nameText, { prop: "alpha", from: 0, to: 0.7, start: NAME_AT, duration: 0.6, ease: outQuad })
      .to(nameText, { prop: "y", from: nameY + colW * 0.014, to: nameY, start: NAME_AT, duration: 0.95, ease: outExpo });
  }
  y += F_HEADER * colW;

  // --- Stats row ---
  if (showStats) {
    y += F_G1 * colW;
    const statsTop = y;
    const statsH = F_STATS * colW;
    const cellW = colW / stats.length;
    const valueSize0 = Math.round(colW * 0.05);
    const labelSize0 = Math.round(colW * 0.031);
    stats.forEach((s, i) => {
      const ccx = left + cellW * (i + 0.5);
      const cell = new Container();
      cell.position.set(ccx, statsTop);
      cell.alpha = 0;
      root.addChild(cell);

      const vSize = fitSize(fonts, s.value, "display", 700, valueSize0, cellW * 0.88);
      const vText = makeText(fonts, { text: s.value, role: "display", weight: 700, size: vSize, color: textColor, anchor: 0.5 });
      vText.position.set(0, statsH * 0.33);
      cell.addChild(vText);

      if (s.label.length > 0) {
        const lSize = fitSize(fonts, s.label, "body", 500, labelSize0, cellW * 0.9);
        const lText = makeText(fonts, { text: s.label, role: "body", weight: 500, size: lSize, color: textColor, anchor: 0.5 });
        lText.position.set(0, statsH * 0.78);
        lText.alpha = 0.68;
        cell.addChild(lText);
      }

      const start = STATS_AT + i * STATS_STAGGER;
      timeline
        .to(cell, { prop: "alpha", from: 0, to: 1, start, duration: 0.6, ease: outQuad })
        .to(cell, { prop: "y", from: statsTop + colW * 0.02, to: statsTop, start, duration: 1.0, ease: outExpo });
    });
    y += statsH;
  }

  // --- Hairline rule, drawn out from the left ---
  if (showRule) {
    y += F_G2 * colW;
    const ruleH = Math.max(1.5, F_RULE * colW);
    const rule = new Graphics().rect(0, 0, colW, ruleH).fill({ color: textColor, alpha: 0.14 });
    rule.position.set(left, y);
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: RULE_AT, duration: 1.0, ease: inOutCubic });
    y += ruleH;
  }

  // --- 3×3 feed grid, arriving on a diagonal wave ---
  y += F_G3 * colW;
  const gap = colW * 0.028;
  const tile = (colW - gap * 2) / 3;
  const tileR = tile * 0.085;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const pair = grads[i] ?? TILE_GRADS[0]!;
      const tcx = left + c * (tile + gap) + tile / 2;
      const tcy = y + r * (tile + gap) + tile / 2;

      const box = new Container();
      box.position.set(tcx, tcy);
      box.alpha = 0;
      box.scale.set(0.94);
      root.addChild(box);
      box.addChild(new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, tileR).fill(linGrad(pair[0], pair[1])));

      if (showMarks && (i === 2 || i === 3)) {
        const mx = tile * 0.31;
        const my = -tile * 0.31;
        if (i === 2) {
          box.addChild(new Graphics().circle(mx, my, tile * 0.1).fill({ color: "#FFFFFF", alpha: 0.92 }));
          const play = makeIcon("play", tile * 0.1, { color: "#1A1D22" });
          play.position.set(mx + tile * 0.008, my);
          box.addChild(play);
        } else {
          const s = tile * 0.075;
          box.addChild(new Graphics().roundRect(mx - s * 0.15, my - s * 0.85, s, s, s * 0.2).fill({ color: "#FFFFFF", alpha: 0.6 }));
          box.addChild(new Graphics().roundRect(mx - s * 0.85, my - s * 0.15, s, s, s * 0.2).fill({ color: "#FFFFFF", alpha: 0.92 }));
        }
      }

      const start = TILE_AT + (r + c) * TILE_STAGGER;
      timeline
        .to(box, { prop: "alpha", from: 0, to: 1, start, duration: 0.55, ease: outQuad })
        .to(box, { prop: "y", from: tcy + tile * 0.16, to: tcy, start, duration: 0.9, ease: outExpo })
        .to(box, { prop: "scale.x", from: 0.94, to: 1, start, duration: 0.9, ease: outExpo })
        .to(box, { prop: "scale.y", from: 0.94, to: 1, start, duration: 0.9, ease: outExpo });
    }
  }

  return { timeline, duration: DURATION };
}

export const profileGrid: TemplateDefinition = {
  id: "profile-grid",
  name: "Profile Grid",
  tagline: "A profile header settles, then the 3×3 feed fills on a diagonal wave.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { handle: "display", name: "body", stats: "display" },
  palettes: PALETTES,
  fields: [
    { key: "handle", type: "text", label: "Handle", default: "@northlight.studio", maxLength: 24, shrinkToFit: true },
    { key: "name", type: "text", label: "Bio line", default: "Design & motion, Rotterdam", maxLength: 40, shrinkToFit: true },
    {
      key: "stats",
      type: "textlist",
      label: "Stats",
      default: DEFAULT_STATS,
      minItems: 3,
      maxItems: 3,
      maxLength: 18,
      help: 'One per line as "value|label", e.g. "24.6K|Followers".',
    },
    { key: "showStats", type: "toggle", label: "Stats row", default: true },
    { key: "showRule", type: "toggle", label: "Hairline rule", default: true },
    { key: "showRing", type: "toggle", label: "Avatar ring", default: true },
    { key: "showTileMarks", type: "toggle", label: "Tile markers", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
