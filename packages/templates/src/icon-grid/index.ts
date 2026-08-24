import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// The fixed, pleasing icon cycle for the grid tiles (row-major). Up to 12 —
// enough for the tallest grid (3×4 on 9:16).
const TILE_ICONS: IconName[] = [
  "star",
  "heart",
  "bell",
  "bolt",
  "cart",
  "comment",
  "check",
  "pin",
  "thumb",
  "plus",
  "share",
  "play",
];

const HERO_ICONS: IconName[] = ["star", "heart", "bell", "bolt", "cart", "check"];

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", textColor: "#2A0F06", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", textColor: "#241452", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#ECFBF3", textColor: "#06301F", accent: "#12B76A", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
];

interface GridCfg {
  cols: number;
  rows: number;
  topF: number;
  botF: number;
  capYF: number;
  capF: number;
}

const GRID: Record<Aspect, GridCfg> = {
  "1:1": { cols: 3, rows: 3, topF: 0.13, botF: 0.73, capYF: 0.86, capF: 0.052 },
  "4:5": { cols: 3, rows: 3, topF: 0.11, botF: 0.69, capYF: 0.83, capF: 0.052 },
  "9:16": { cols: 3, rows: 4, topF: 0.17, botF: 0.7, capYF: 0.77, capF: 0.058 },
  "16:9": { cols: 4, rows: 2, topF: 0.15, botF: 0.71, capYF: 0.88, capF: 0.044 },
};

/** Create text, and if it would overflow `maxWidth`, re-make it one size smaller
 * (crisp — never a scaled-up bitmap). Width scales ~linearly with font size. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const textColor = str(values.textColor, pc("textColor", "#2A0F06"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const caption = str(values.caption, "Everything you need to post");
  const heroIcon = str(values.hero, "star") as IconName;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const cfg = GRID[ctx.aspect];
  const { cols, rows } = cfg;
  const w = size.width;
  const h = size.height;
  const availW = w * 0.84;
  const bandH = h * (cfg.botF - cfg.topF);
  const cellPitch = Math.min(availW / cols, bandH / rows);
  const gridW = cellPitch * cols;
  const gridH = cellPitch * rows;
  const gridCenterY = h * ((cfg.topF + cfg.botF) / 2);
  const originX = w / 2 - gridW / 2;
  const originY = gridCenterY - gridH / 2;
  const heroIndex = Math.floor((rows - 1) / 2) * cols + Math.floor((cols - 1) / 2);

  const timeline = new JimaTimeline();
  const tiles: Container[] = [];
  let heroInner: Container | null = null;

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = new Container();
      tile.position.set(originX + (c + 0.5) * cellPitch, originY + (r + 0.5) * cellPitch);
      tile.scale.set(0);
      tile.alpha = 0;

      if (idx === heroIndex) {
        const inner = new Container();
        const side = cellPitch * 0.9;
        inner.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, side * 0.22).fill(accent));
        inner.addChild(makeIcon(heroIcon, side * 0.52, { color: onAccent, holeColor: accent }));
        tile.addChild(inner);
        heroInner = inner;
      } else {
        const side = cellPitch * 0.8;
        const chip = new Graphics().roundRect(-side / 2, -side / 2, side, side, side * 0.22).fill(accent);
        chip.alpha = 0.18;
        tile.addChild(chip);
        const name = TILE_ICONS[idx % TILE_ICONS.length]!;
        tile.addChild(makeIcon(name, side * 0.5, { color: accent, holeColor: bg }));
      }

      root.addChild(tile);
      tiles.push(tile);
      idx++;
    }
  }

  // Row-major staggered spring-in.
  const STAG = 0.06;
  const T0 = 0.25;
  tiles.forEach((tile, i) => {
    const start = T0 + i * STAG;
    timeline
      .to(tile, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(tile, { prop: "scale.x", from: 0, to: 1, start, duration: 0.66, ease: spring(0.5) })
      .to(tile, { prop: "scale.y", from: 0, to: 1, start, duration: 0.66, ease: spring(0.5) });
  });

  // Caption below the grid.
  const capSize = Math.round(w * cfg.capF);
  const capY = h * cfg.capYF;
  const capText = fitText(
    fonts,
    { text: caption, role: "display", weight: 700, size: capSize, color: textColor, anchor: 0.5, align: "center" },
    w * 0.86,
  );
  capText.position.set(w / 2, capY);
  capText.alpha = 0;
  root.addChild(capText);
  timeline
    .to(capText, { prop: "alpha", from: 0, to: 1, start: 1.5, duration: 0.5, ease: outQuad })
    .to(capText, { prop: "y", from: capY + 26, to: capY, start: 1.5, duration: 0.6, ease: outExpo });

  // Hero pulse (deterministic breathing, pure in t) after entrance settles.
  const PULSE_AT = 1.75;
  const PERIOD = 1.5;
  const update = (t: number): void => {
    if (!heroInner) return;
    const tau = t - PULSE_AT;
    const p = tau <= 0 ? 0 : (1 - Math.cos((tau / PERIOD) * Math.PI * 2)) / 2;
    heroInner.scale.set(1 + 0.06 * p);
  };

  return { timeline, duration: 3.6, update };
}

export const iconGrid: TemplateDefinition = {
  id: "icon-grid",
  name: "Icon Grid",
  tagline: "A grid of icon tiles pops in around a hero.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  palettes: PALETTES,
  fields: [
    { key: "caption", type: "text", label: "Caption", default: "Everything you need to post", maxLength: 44, shrinkToFit: true },
    {
      key: "hero",
      type: "select",
      label: "Hero icon",
      default: "star",
      options: HERO_ICONS.map((n) => ({ value: n, label: n.charAt(0).toUpperCase() + n.slice(1) })),
    },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
