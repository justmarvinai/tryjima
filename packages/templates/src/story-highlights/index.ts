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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// Decorative gradient pairs for the highlight covers (photo stand-ins).
const GRADS: [string, string][] = [
  ["#7C5CFF", "#4457E8"],
  ["#FF5B72", "#FF9A3D"],
  ["#12B886", "#3BC9DB"],
  ["#FF2E9E", "#7C5CFF"],
  ["#2E8BFF", "#22D3EE"],
  ["#FFB020", "#FF6A3D"],
];

/** A circle filled with a two-tone diagonal "gradient" block. */
function gradCircle(r: number, c1: string, c2: string): Container {
  const c = new Container();
  c.addChild(new Graphics().circle(0, 0, r).fill(c1));
  const gh = new Container();
  const tri = new Graphics().poly([-r, r * 0.2, r, -r, r, r, -r, r]).fill(c2);
  const gm = new Graphics().circle(0, 0, r).fill(0xffffff);
  gh.addChild(tri, gm);
  tri.mask = gm;
  c.addChild(gh);
  return c;
}

// An Instagram Highlights row: circular gradient covers with a colored story
// ring and labels, popping in staggered. Full-frame `bg` carries the background;
// covers are decorative gradient blocks and `accent` is the story ring.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#12141A", accent: "#FF3B5C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", textColor: "#FFFFFF", accent: "#FF7A3D" } },
  { id: "blush", name: "Blush", colors: { background: "#FFF1F5", textColor: "#2A0A18", accent: "#FF2E9E" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FF", textColor: "#0B2447", accent: "#2E7DF6" } },
];

const DEFAULT_LABELS = ["Travel", "Food", "Style", "Work", "Pets"];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#12141A"));
  const accent = str(values.accent, pc("accent", "#FF3B5C"));
  const showLabels = on(values.showLabels);
  const labels = asList(values.labels, DEFAULT_LABELS).slice(0, 6);
  const n = Math.max(3, labels.length);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Row geometry ---
  const gap = Math.round(minDim * 0.032);
  const maxD = (safe.width - (n - 1) * gap) / n;
  const d = Math.min(maxD, minDim * 0.26);
  const R = d / 2;
  const ringW = Math.max(3, Math.round(R * 0.07));
  const ringGap = Math.round(R * 0.09);
  const rInner = R - ringW - ringGap;

  const rowW = n * d + (n - 1) * gap;
  const rowLeft = cx - rowW / 2;

  const labelSize = Math.round(minDim * 0.028);
  const labelGap = Math.round(minDim * 0.024);
  const blockH = d + (showLabels ? labelGap + labelSize : 0);
  const rowCy = safe.y + Math.max(0, (safe.height - blockH) / 2) + R;

  for (let i = 0; i < n; i++) {
    const g = GRADS[i % GRADS.length]!;
    const ccx = rowLeft + i * (d + gap) + R;

    const cover = new Container();
    cover.position.set(ccx, rowCy);
    cover.scale.set(0);
    cover.alpha = 0;
    root.addChild(cover);
    // Colored story ring + gradient cover.
    cover.addChild(new Graphics().circle(0, 0, R - ringW / 2).stroke({ color: accent, width: ringW }));
    cover.addChild(gradCircle(rInner, g[0], g[1]));

    const start = 0.35 + i * 0.12;
    timeline
      .to(cover, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(cover, { prop: "scale.x", from: 0, to: 1, start, duration: 0.6, ease: spring(0.48) })
      .to(cover, { prop: "scale.y", from: 0, to: 1, start, duration: 0.6, ease: spring(0.48) });

    if (showLabels) {
      const raw = labels[i] ?? "";
      if (raw.length > 0) {
        const lSize = fitSize(fonts, raw, "body", 600, labelSize, d * 1.08);
        const labelText = makeText(fonts, { text: raw, role: "body", weight: 600, size: lSize, color: textColor, anchor: 0.5, align: "center" });
        const ly = rowCy + R + labelGap + labelSize / 2;
        labelText.position.set(ccx, ly + minDim * 0.012);
        labelText.alpha = 0;
        root.addChild(labelText);
        timeline
          .to(labelText, { prop: "alpha", from: 0, to: 1, start: start + 0.1, duration: 0.35, ease: outQuad })
          .to(labelText, { prop: "y", from: ly + minDim * 0.012, to: ly, start: start + 0.1, duration: 0.45, ease: outExpo });
      }
    }
  }

  return { timeline, duration: 3.6 };
}

export const storyHighlights: TemplateDefinition = {
  id: "story-highlights",
  name: "Story Highlights",
  tagline: "A row of circular highlight covers pops in staggered with their labels.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { labels: "body" },
  palettes: PALETTES,
  fields: [
    { key: "labels", type: "textlist", label: "Cover labels", default: DEFAULT_LABELS, minItems: 3, maxItems: 6, maxLength: 14, help: "One label per line (3–6 covers)." },
    { key: "showLabels", type: "toggle", label: "Labels", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Story ring", default: "", optional: true },
  ],
  build,
};
