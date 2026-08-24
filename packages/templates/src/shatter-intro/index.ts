import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inQuad,
  outCubic,
  outQuad,
  outQuint,
  safeRect,
  type Aspect,
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
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

interface Pt {
  x: number;
  y: number;
}

/** Sutherland–Hodgman clip of a polygon against one half-plane (inside(p) >= 0 keeps p). */
function clipHalf(poly: readonly Pt[], inside: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const da = inside(a);
    const db = inside(b);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const u = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    }
  }
  return out;
}

function clipToRect(poly: readonly Pt[], w: number, h: number): Pt[] {
  let p = clipHalf(poly, (q) => q.x);
  p = clipHalf(p, (q) => w - q.x);
  p = clipHalf(p, (q) => q.y);
  p = clipHalf(p, (q) => h - q.y);
  return p;
}

function centroid(poly: readonly Pt[]): Pt {
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

/** Where a ray from (px,py) along (dx,dy) exits the w x h rect. */
function rayExit(px: number, py: number, dx: number, dy: number, w: number, h: number): Pt {
  let t = Number.POSITIVE_INFINITY;
  if (dx > 1e-6) t = Math.min(t, (w - px) / dx);
  else if (dx < -1e-6) t = Math.min(t, -px / dx);
  if (dy > 1e-6) t = Math.min(t, (h - py) / dy);
  else if (dy < -1e-6) t = Math.min(t, -py / dy);
  if (!Number.isFinite(t)) t = 0;
  return { x: px + dx * t, y: py + dy * t };
}

/** Stroke the first `frac` of a polyline's length. */
function strokePartial(g: Graphics, pts: readonly Pt[], frac: number, color: string, width: number, alpha: number): void {
  if (frac <= 0 || pts.length < 2) return;
  let total = 0;
  const lens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    lens.push(l);
    total += l;
  }
  let remain = total * Math.min(1, frac);
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 0; i < pts.length - 1; i++) {
    const l = lens[i]!;
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (remain >= l) {
      g.lineTo(b.x, b.y);
      remain -= l;
    } else {
      const u = l <= 0 ? 0 : remain / l;
      g.lineTo(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u);
      break;
    }
  }
  g.stroke({ color, width, alpha, cap: "round", join: "round" });
}

// A colored pane covers the frame; cracks snap out from a seeded impact point,
// then the pane shatters into ten irregular shards that fall and tumble away,
// revealing the title. The end frame is title-on-background (>= 4.5:1).
const PALETTES: Palette[] = [
  { id: "tangerine", name: "Tangerine", colors: { background: "#FDF6EC", textColor: "#2B1A06", accent: "#F59427" } },
  { id: "raspberry", name: "Raspberry", colors: { background: "#FCF0F5", textColor: "#33101F", accent: "#E23A7A" } },
  { id: "ultramarine", name: "Ultramarine", colors: { background: "#EFF3FD", textColor: "#131F4A", accent: "#3E5BE8" } },
  { id: "jade", name: "Jade", colors: { background: "#EFF9F3", textColor: "#0D2B1D", accent: "#17A36F" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.08 : aspect === "9:16" ? 0.105 : 0.095;
}

const WEDGES = 5; // 5 inner + 5 outer shards = 10
const TAU = Math.PI * 2;
const SHATTER = 1.1;
const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FDF6EC"));
  const textColor = str(values.textColor, pc("textColor", "#2B1A06"));
  const pane = str(values.accent, pc("accent", "#F59427"));
  const title = str(values.title, "Big Reveal");
  const subtitle = str(values.subtitle, "something new is here");
  const showCracks = on(values.showCracks);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Title lockup (beneath the pane) ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.6 : 0.84);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.28);
  const lineGap = subSize * 1.05;
  const totalH = titleSize + (hasSub ? lineGap + subSize : 0);

  const titleY = centerY - totalH / 2 + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 1.25, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 18, to: titleY, start: 1.25, duration: 0.5, ease: outQuint });

  if (hasSub) {
    const subY = centerY + totalH / 2 - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subText.position.set(cx, subY + 12);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.82, start: 1.55, duration: 0.4, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 12, to: subY, start: 1.55, duration: 0.45, ease: outQuint });
  }

  // --- Cover group (pane + shards + cracks); jolted on impact ---
  const cover = new Container();
  root.addChild(cover);

  // Solid pane behind the shards hides hairline seams until the shatter moment.
  const paneRect = new Graphics().rect(0, 0, w, h).fill(pane);
  cover.addChild(paneRect);
  timeline.to(paneRect, { prop: "alpha", from: 1, to: 0, start: SHATTER, duration: 0 });

  // Seeded impact point + shard geometry (5 wedges split by a mid ring -> 10 shards).
  const px = w * (0.5 + rng.range(-0.08, 0.08));
  const py = h * (0.42 + rng.range(-0.06, 0.06));
  const a0 = rng.range(0, TAU / WEDGES);
  const angles: number[] = [];
  const mids: Pt[] = [];
  for (let i = 0; i < WEDGES; i++) {
    angles.push(a0 + (i / WEDGES) * TAU + rng.range(-0.3, 0.3));
  }
  for (let i = 0; i < WEDGES; i++) {
    const m = minDim * rng.range(0.2, 0.38);
    mids.push({ x: px + Math.cos(angles[i]!) * m, y: py + Math.sin(angles[i]!) * m });
  }
  const R = w + h;
  const far: Pt[] = angles.map((a) => ({ x: px + Math.cos(a) * R, y: py + Math.sin(a) * R }));

  const rawShards: Pt[][] = [];
  for (let i = 0; i < WEDGES; i++) {
    const j = (i + 1) % WEDGES;
    rawShards.push([{ x: px, y: py }, mids[i]!, mids[j]!]); // inner
    rawShards.push([mids[i]!, far[i]!, far[j]!, mids[j]!]); // outer
  }

  interface Shard {
    node: Container;
    x0: number;
    y0: number;
    dist: number;
  }
  const shards: Shard[] = [];
  const shardShades: Graphics[] = [];
  for (const raw of rawShards) {
    const clipped = clipToRect(raw, w, h);
    // Reserve this shard's shade randomness even if it clips away (stable stream).
    const shadeCol = rng.pick(["#000000", "#FFFFFF"]);
    const shadeAlpha = rng.range(0.02, 0.07);
    if (clipped.length < 3) continue;
    const c = centroid(clipped);
    const rel: number[] = [];
    for (const p of clipped) rel.push(p.x - c.x, p.y - c.y);

    const node = new Container();
    node.position.set(c.x, c.y);
    node.addChild(new Graphics().poly(rel).fill(pane));
    const shade = new Graphics().poly(rel).fill({ color: shadeCol, alpha: shadeAlpha });
    shade.alpha = 0;
    node.addChild(shade);
    shardShades.push(shade);
    cover.addChild(node);
    shards.push({ node, x0: c.x, y0: c.y, dist: Math.hypot(c.x - px, c.y - py) });
  }
  const maxDist = shards.reduce((m, s) => Math.max(m, s.dist), 1);

  // Shatter: shards get an outward push, then gravity takes over.
  for (const s of shards) {
    const len = Math.max(1, s.dist);
    const dirX = (s.x0 - px) / len;
    const dirY = (s.y0 - py) / len;
    const speed = minDim * rng.range(0.35, 0.75);
    const st = SHATTER + (s.dist / maxDist) * 0.1 + rng.range(0, 0.04);
    const durS = rng.range(0.9, 1.2);
    timeline
      .to(s.node, { prop: "x", from: s.x0, to: s.x0 + dirX * speed * 0.9 + rng.range(-40, 40), start: st, duration: durS, ease: outQuad })
      .to(s.node, { prop: "y", from: s.y0, to: s.y0 + dirY * speed * 0.35 + h * rng.range(0.55, 0.95), start: st, duration: durS, ease: inQuad })
      .to(s.node, { prop: "rotation", from: 0, to: rng.range(-2.2, 2.2), start: st, duration: durS, ease: inQuad })
      .to(s.node, { prop: "alpha", from: 1, to: 0, start: st + durS * 0.55, duration: durS * 0.45, ease: outQuad });
  }

  // --- Cracks drawn from the impact point (decorative) ---
  const crack = { r: 0, g: 0 };
  let crackG: Graphics | null = null;
  const radials: Pt[][] = [];
  const ringSegs: Pt[][] = [];
  if (showCracks) {
    crackG = new Graphics();
    cover.addChild(crackG);
    for (let i = 0; i < WEDGES; i++) {
      const a = angles[i]!;
      radials.push([{ x: px, y: py }, mids[i]!, rayExit(px, py, Math.cos(a), Math.sin(a), w, h)]);
      ringSegs.push([mids[i]!, mids[(i + 1) % WEDGES]!]);
    }
    timeline
      .to(crack, { prop: "r", from: 0, to: 1, start: 0.38, duration: 0.45, ease: outCubic })
      .to(crack, { prop: "g", from: 0, to: 1, start: 0.62, duration: 0.35, ease: outCubic })
      .to(crackG, { prop: "alpha", from: 1, to: 0, start: SHATTER, duration: 0.12, ease: outQuad });

    // Facet shading appears as the pane fractures.
    for (const shade of shardShades) {
      timeline.to(shade, { prop: "alpha", from: 0, to: 1, start: 0.5 + rng.range(0, 0.3), duration: 0.35, ease: outQuad });
    }

    // Two impact jolts on the whole pane.
    timeline
      .to(cover, { prop: "x", from: 0, to: -6, start: 0.34, duration: 0.05, ease: outQuad })
      .to(cover, { prop: "x", from: -6, to: 5, start: 0.39, duration: 0.05, ease: outQuad })
      .to(cover, { prop: "x", from: 5, to: 0, start: 0.44, duration: 0.08, ease: outQuad })
      .to(cover, { prop: "x", from: 0, to: 4, start: 0.92, duration: 0.05, ease: outQuad })
      .to(cover, { prop: "x", from: 4, to: -3, start: 0.97, duration: 0.05, ease: outQuad })
      .to(cover, { prop: "x", from: -3, to: 0, start: 1.02, duration: 0.07, ease: outQuad });
  }

  const wCr = Math.max(2, minDim * 0.0045);
  const update = (t: number): void => {
    if (!crackG) return;
    crackG.clear();
    if (t >= SHATTER + 0.25) return; // faded out — skip the redraw
    for (let i = 0; i < radials.length; i++) {
      const u = clamp01((crack.r - i * 0.05) / 0.75);
      strokePartial(crackG, radials[i]!, u, "#000000", wCr, 0.5);
    }
    for (let i = 0; i < ringSegs.length; i++) {
      const u = clamp01((crack.g - i * 0.08) / 0.6);
      strokePartial(crackG, ringSegs[i]!, u, "#000000", wCr * 0.8, 0.4);
    }
  };

  return { timeline, duration: DURATION, update };
}

export const shatterIntro: TemplateDefinition = {
  id: "shatter-intro",
  name: "Shatter Intro",
  tagline: "A colored pane cracks and shatters into shards, revealing your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Big Reveal", maxLength: 24, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "something new is here", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showCracks", type: "toggle", label: "Crack lines", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Pane", default: "", optional: true },
  ],
  build,
};
