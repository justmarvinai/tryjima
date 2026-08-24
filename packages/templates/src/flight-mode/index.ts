import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
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

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// All-light palettes on purpose: the piece is a light-mode Control Center drop,
// the owner's explicit brief. `panelColor` is the tile, `accent` the airplane-
// mode "on" fill (iOS orange family), `textColor` the title ink on `background`.
const PALETTES: Palette[] = [
  { id: "daylight", name: "Daylight", colors: { background: "#F4F5F8", panelColor: "#FFFFFF", textColor: "#15171C", accent: "#F28900" } },
  { id: "cabin-sky", name: "Cabin sky", colors: { background: "#E9F2FD", panelColor: "#FFFFFF", textColor: "#12283E", accent: "#E8720C" } },
  { id: "boarding-cream", name: "Boarding cream", colors: { background: "#F9F3E8", panelColor: "#FFFFFF", textColor: "#271F15", accent: "#D95E0F" } },
  { id: "terminal-mist", name: "Terminal mist", colors: { background: "#EFEFF4", panelColor: "#FBFBFD", textColor: "#131417", accent: "#EA7A18" } },
];

// iOS system colors for the other radios (fixed, not palette-driven — they read
// as "the phone UI", while the palette drives the frame around it).
const IOS_GREEN = "#34C759";
const IOS_BLUE = "#0A84FF";
const CIRCLE_OFF = "#E9E9EE"; // inactive button fill (light mode)
const ICON_OFF = "#3A3A41"; // inactive glyph ink
const ICON_DIM = "#B9B9C2"; // radios after airplane mode kills them

// --- Choreography (seconds; duration is a fixed constant) ---
const DROP_START = 0.05;
const DROP_DUR = 0.95;
const PRESS_AT = 1.45; // finger-down
const PRESS_DUR = 0.13;
const RELEASE_AT = 1.66; // heavy bouncy release + orange activation
const RADIOS_AT = 1.82; // wifi/cellular/bluetooth give up
const PILL_AT = 2.02;
const LIFT_AT = 2.72; // the flyer takes over from the button glyph (seamless)
const EXIT_END = 4.5; // fully clear of the frame
const PILL_OUT_AT = 3.35;
const ICON_BACK_AT = 3.98; // glyph returns while the plane is still leaving
const TITLE_AT = 3.92;
const SUB_AT = 4.16;
const DURATION = 5.4;

const TRAIL = 5; // ghost copies lagging the plane during the fast exit

// Right half of the airplane silhouette, nose-up, in units of `s` — mirrored for
// the left so the glyph is perfectly symmetric. ONE closed path (not a fuselage
// plus separate wing polys): overlapping fills showed hairline seams where the
// wing roots met the body, which the scaled-up takeoff magnified badly.
const PLANE_HALF: [number, number][] = [
  [0, -0.5], // nose
  [0.043, -0.3],
  [0.058, -0.09], // wing root, leading edge
  [0.46, 0.15], // wingtip, leading edge
  [0.46, 0.238], // wingtip, trailing edge
  [0.064, 0.095], // wing root, trailing edge
  [0.054, 0.3], // fuselage at the tailplane
  [0.183, 0.418], // tailtip, leading edge
  [0.183, 0.474], // tailtip, trailing edge
  [0.036, 0.4], // tail root, trailing edge
  [0.03, 0.474],
  [0, 0.5], // tail centre
];

/** Solid airplane-mode silhouette pointing UP, centred at (0,0), height ~= s. */
function makeAirplane(s: number, color: string): Graphics {
  const pts: number[] = [];
  for (const [x, y] of PLANE_HALF) pts.push(x * s, y * s);
  // mirror back up the left side (skip the shared nose/tail vertices)
  for (let i = PLANE_HALF.length - 2; i >= 1; i--) {
    const p = PLANE_HALF[i]!;
    pts.push(-p[0] * s, p[1] * s);
  }
  return new Graphics().poly(pts).fill(color);
}

/** WiFi glyph: 3 arcs + dot, centred, pointing up. */
function makeWifi(s: number, color: string): Graphics {
  const g = new Graphics();
  const cxy = 0.32 * s; // arc centre sits low so the fan points up
  for (let i = 0; i < 3; i++) {
    const r = (0.28 + i * 0.22) * s;
    g.arc(0, cxy, r, Math.PI * 1.28, Math.PI * 1.72).stroke({ width: 0.11 * s, color, cap: "round" });
  }
  g.circle(0, cxy - 0.02 * s, 0.075 * s).fill(color);
  return g;
}

/** Bluetooth rune: stroked polyline, centred. */
function makeBluetooth(s: number, color: string): Graphics {
  const g = new Graphics();
  const wdt = { width: 0.1 * s, color, cap: "round" as const, join: "round" as const };
  g.moveTo(0, -0.5 * s).lineTo(0, 0.5 * s).stroke(wdt);
  g.moveTo(0, -0.5 * s).lineTo(0.26 * s, -0.26 * s).lineTo(-0.26 * s, 0.26 * s).stroke(wdt);
  g.moveTo(0, 0.5 * s).lineTo(0.26 * s, 0.26 * s).lineTo(-0.26 * s, -0.26 * s).stroke(wdt);
  return g;
}

/** Cellular bars: 4 ascending rounded bars, centred. */
function makeCellular(s: number, color: string): Graphics {
  const g = new Graphics();
  const bw = 0.16 * s;
  const gap = 0.09 * s;
  const total = 4 * bw + 3 * gap;
  for (let i = 0; i < 4; i++) {
    const bh = (0.3 + i * 0.22) * s;
    g.roundRect(-total / 2 + i * (bw + gap), 0.5 * s - bh, bw, bh, bw * 0.4).fill(color);
  }
  return g;
}

/** Soft multi-pass shadow (thick single layers band into grey outlines on white). */
function softShadow(w: number, h: number, r: number): Container {
  const c = new Container();
  for (let i = 7; i >= 1; i--) {
    const grow = i * 7;
    const g = new Graphics()
      .roundRect(-w / 2 - grow, -h / 2 - grow + i * 3.2, w + grow * 2, h + grow * 2, r + grow)
      .fill({ color: "#0B0E14", alpha: 0.022 });
    c.addChild(g);
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, aspect } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F5F8"));
  const panelColor = str(values.panelColor, pc("panelColor", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#15171C"));
  const accent = str(values.accent, pc("accent", "#F28900"));

  const title = str(values.title, "");
  const subline = str(values.subline, "");
  // "" (not the default) so a cleared field actually removes the pill.
  const label = str(values.label, "");
  const showLabel = values.showLabel !== false;
  const showShadow = values.showShadow !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeRect(aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const tile = Math.min(minDim * 0.44, zone.width * 0.7);
  const pad = tile * 0.095;
  const gap = tile * 0.09;
  const d = (tile - 2 * pad - gap) / 2; // circle diameter
  const iconS = d * 0.52;
  const tileR = tile * 0.235;
  const panelCy = zone.y + zone.height * (aspect === "16:9" ? 0.42 : 0.4);

  // --- Panel group (drops in as one) ---
  const panelGroup = new Container();
  panelGroup.position.set(cx, panelCy);
  root.addChild(panelGroup);

  if (showShadow) {
    const shadow = softShadow(tile, tile, tileR);
    shadow.alpha = 0;
    panelGroup.addChild(shadow);
    timeline.to(shadow, { prop: "alpha", from: 0, to: 1, start: DROP_START + 0.35, duration: 0.5, ease: outQuad });
  }

  const plate = new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, tileR).fill(panelColor);
  panelGroup.addChild(plate);

  // Button positions (2x2)
  const off = (d + gap) / 2;
  const positions: [number, number][] = [
    [-off, -off], // airplane
    [off, -off], // cellular
    [-off, off], // wifi
    [off, off], // bluetooth
  ];

  // --- Airplane button (the hero) ---
  const btn = new Container();
  btn.position.set(positions[0]![0], positions[0]![1]);
  panelGroup.addChild(btn);

  const circleOff = new Graphics().circle(0, 0, d / 2).fill(CIRCLE_OFF);
  const circleOn = new Graphics().circle(0, 0, d / 2).fill(accent);
  circleOn.alpha = 0;
  const planeOff = makeAirplane(iconS, ICON_OFF);
  const planeOn = makeAirplane(iconS, "#FFFFFF");
  planeOn.alpha = 0;
  btn.addChild(circleOff, circleOn, planeOff, planeOn);

  // --- Radio buttons (active, then dimmed by airplane mode) ---
  const radios: { onLayer: Container; offLayer: Container }[] = [];
  const radioSpecs: { pos: [number, number]; fill: string; glyph: (s: number, c: string) => Graphics }[] = [
    { pos: positions[1]!, fill: IOS_GREEN, glyph: makeCellular },
    { pos: positions[2]!, fill: IOS_BLUE, glyph: makeWifi },
    { pos: positions[3]!, fill: IOS_BLUE, glyph: makeBluetooth },
  ];
  for (const spec of radioSpecs) {
    const holder = new Container();
    holder.position.set(spec.pos[0], spec.pos[1]);
    panelGroup.addChild(holder);
    const offLayer = new Container();
    offLayer.addChild(new Graphics().circle(0, 0, d / 2).fill(CIRCLE_OFF), spec.glyph(iconS, ICON_DIM));
    const onLayer = new Container();
    onLayer.addChild(new Graphics().circle(0, 0, d / 2).fill(spec.fill), spec.glyph(iconS, "#FFFFFF"));
    holder.addChild(offLayer, onLayer);
    radios.push({ onLayer, offLayer });
  }

  // --- Drop in (slightly bouncy, smooth) ---
  const fromY = -(tile / 2 + 120);
  timeline.to(panelGroup, { prop: "y", from: fromY, to: panelCy, start: DROP_START, duration: DROP_DUR, ease: makeOutBack(1.3) });
  timeline.to(panelGroup, { prop: "alpha", from: 0, to: 1, start: DROP_START, duration: 0.4, ease: outQuad });

  // --- Press (heavy) ---
  timeline
    .to(btn, { prop: "scale.x", from: 1, to: 0.82, start: PRESS_AT, duration: PRESS_DUR, ease: outQuad })
    .to(btn, { prop: "scale.y", from: 1, to: 0.82, start: PRESS_AT, duration: PRESS_DUR, ease: outQuad })
    .to(btn, { prop: "scale.x", from: 0.82, to: 1, start: RELEASE_AT, duration: 0.5, ease: makeOutBack(2.9) })
    .to(btn, { prop: "scale.y", from: 0.82, to: 1, start: RELEASE_AT, duration: 0.5, ease: makeOutBack(2.9) });
  // the whole panel feels the impact
  timeline
    .to(panelGroup, { prop: "scale.x", from: 1, to: 0.984, start: RELEASE_AT - 0.02, duration: 0.09, ease: outQuad })
    .to(panelGroup, { prop: "scale.y", from: 1, to: 0.984, start: RELEASE_AT - 0.02, duration: 0.09, ease: outQuad })
    .to(panelGroup, { prop: "scale.x", from: 0.984, to: 1, start: RELEASE_AT + 0.07, duration: 0.42, ease: makeOutBack(2.2) })
    .to(panelGroup, { prop: "scale.y", from: 0.984, to: 1, start: RELEASE_AT + 0.07, duration: 0.42, ease: makeOutBack(2.2) });
  // orange activation
  timeline
    .to(circleOn, { prop: "alpha", from: 0, to: 1, start: RELEASE_AT - 0.04, duration: 0.2, ease: outQuad })
    .to(planeOn, { prop: "alpha", from: 0, to: 1, start: RELEASE_AT - 0.04, duration: 0.2, ease: outQuad })
    .to(planeOff, { prop: "alpha", from: 1, to: 0, start: RELEASE_AT - 0.04, duration: 0.16, ease: outQuad });
  // airplane mode kills the radios (the grey layer beneath is revealed)
  for (const r of radios) {
    timeline.to(r.onLayer, { prop: "alpha", from: 1, to: 0, start: RADIOS_AT, duration: 0.45, ease: outQuad });
  }

  // --- "Flight Mode: On" pill ---
  const pillY = tile / 2 + minDim * 0.062;
  if (showLabel && label.length > 0) {
    const pillTextSize = Math.round(minDim * 0.026);
    const pillText = makeText(fonts, { text: label, role: "body", weight: 600, size: pillTextSize, color: textColor, anchor: 0.5 });
    const pw = fonts.measure(label, { family: fonts.family("body"), weight: 600, size: pillTextSize }) + pillTextSize * 2.1;
    const ph = pillTextSize * 2.05;
    const pill = new Container();
    pill.position.set(0, pillY);
    const pillBgS = softShadow(pw, ph, ph / 2);
    pillBgS.alpha = 0.6;
    pill.addChild(pillBgS, new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill(panelColor), pillText);
    panelGroup.addChild(pill);
    pill.alpha = 0;
    timeline
      .to(pill, { prop: "alpha", from: 0, to: 1, start: PILL_AT, duration: 0.28, ease: outQuad })
      .to(pill, { prop: "scale.x", from: 0.7, to: 1, start: PILL_AT, duration: 0.5, ease: makeOutBack(1.9) })
      .to(pill, { prop: "scale.y", from: 0.7, to: 1, start: PILL_AT, duration: 0.5, ease: makeOutBack(1.9) })
      .to(pill, { prop: "alpha", from: 1, to: 0, start: PILL_OUT_AT, duration: 0.3, ease: outQuad })
      .to(pill, { prop: "y", from: pillY, to: pillY + minDim * 0.012, start: PILL_OUT_AT, duration: 0.3, ease: outQuad });
  }

  // --- Takeoff -------------------------------------------------------------
  // The plane flies a quadratic bezier whose start tangent is straight up and
  // whose end tangent is up-and-right, so one continuous curve gives both the
  // vertical lift off the button AND the bank away — no two-phase seam. Position,
  // bank and scale are all derived from the same parameter in a pure update(t),
  // which is why the nose always points exactly along the path.
  const bx = cx - off;
  const by = panelCy - off;
  const exitX = w * 0.5 + w * 0.62 + iconS * 4;
  const exitY = -h * 0.55 - iconS * 4;
  // control point directly above the button => initial tangent is vertical
  const ctrlX = bx + w * 0.015;
  const ctrlY = by - h * 0.5;
  const SCALE_MAX = 5.2;

  const planes: Container[] = [];
  for (let i = TRAIL; i >= 0; i--) {
    const c = new Container();
    c.position.set(bx, by);
    c.alpha = 0;
    c.addChild(makeAirplane(iconS, accent));
    root.addChild(c); // ghosts first => they render behind the lead plane
    planes.push(c);
  }
  // The lead plane leaves *from* the orange button, so it starts in the button's
  // white and only turns accent once it is clear of the disc — an orange plane
  // on an orange circle is simply invisible for the first frames of the lift.
  const leadWhite = makeAirplane(iconS, "#FFFFFF");
  planes[planes.length - 1]!.addChild(leadWhite);

  // Seamless handoff: the glyph vanishes on the exact frame the flyer appears,
  // at the same position and scale (a fade-out overlapped the two planes).
  timeline.to(planeOn, { prop: "alpha", from: 1, to: 0, start: LIFT_AT, duration: 0 });
  // …and comes back while the plane is still departing, so the tile is never a
  // bare orange disc under the end card.
  timeline.to(planeOn, { prop: "alpha", from: 0, to: 1, start: ICON_BACK_AT, duration: 0.42, ease: outQuad });

  // --- Title / subline (the vlog intro card) ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.058), zone.width * 0.86);
  const titleY = panelCy + tile / 2 + minDim * (showLabel ? 0.115 : 0.095);
  if (title.length > 0) {
    const t = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
    t.position.set(cx, titleY);
    t.alpha = 0;
    root.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: TITLE_AT, duration: 0.55, ease: outQuad })
      .to(t, { prop: "y", from: titleY + minDim * 0.022, to: titleY, start: TITLE_AT, duration: 0.6, ease: outQuint });
  }
  if (subline.length > 0) {
    const subSize = fitSize(fonts, subline, "body", 500, Math.round(minDim * 0.03), zone.width * 0.8);
    const subY = titleY + titleSize * 0.62 + subSize * 0.9;
    const s2 = makeText(fonts, { text: subline, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center" });
    s2.position.set(cx, subY);
    s2.alpha = 0;
    root.addChild(s2);
    timeline
      .to(s2, { prop: "alpha", from: 0, to: 0.72, start: SUB_AT, duration: 0.55, ease: outQuad })
      .to(s2, { prop: "y", from: subY + minDim * 0.018, to: subY, start: SUB_AT, duration: 0.6, ease: outQuint });
  }

  const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
  /** Distance travelled 0→1: an unhurried lift that builds into a fast exit. */
  const travel = (raw: number): number => 0.32 * raw + 0.68 * Math.pow(raw, 2.4);
  const smooth = (edge0: number, edge1: number, x: number): number => {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };

  function placePlane(node: Container, u: number, alpha: number): void {
    const iu = 1 - u;
    node.position.set(
      iu * iu * bx + 2 * iu * u * ctrlX + u * u * exitX,
      iu * iu * by + 2 * iu * u * ctrlY + u * u * exitY,
    );
    // bank along the path tangent (glyph points up, hence atan2(dx, -dy))
    const dx = 2 * iu * (ctrlX - bx) + 2 * u * (exitX - ctrlX);
    const dy = 2 * iu * (ctrlY - by) + 2 * u * (exitY - ctrlY);
    node.rotation = Math.atan2(dx, -dy);
    const sc = 1 + (SCALE_MAX - 1) * Math.pow(u, 0.82);
    node.scale.set(sc);
    node.alpha = alpha;
  }

  const update = (t: number): void => {
    const raw = clamp01((t - LIFT_AT) / (EXIT_END - LIFT_AT));
    if (t < LIFT_AT) {
      for (const p of planes) p.alpha = 0;
      return;
    }
    const u = travel(raw);
    // White while the plane still overlaps its orange disc, accent once clear.
    // The crossover is tuned to where the silhouette actually leaves the circle:
    // switching earlier put an orange plane on an orange disc, later left a white
    // plane on the white tile.
    leadWhite.alpha = 1 - smooth(0.075, 0.155, u);
    for (let i = 0; i < planes.length; i++) {
      const isLead = i === planes.length - 1;
      if (isLead) {
        placePlane(planes[i]!, u, 1);
        continue;
      }
      // Ghosts hug the plane with a small lag, and only fade up once it is
      // genuinely moving fast — a wide lag strung them back down the path as
      // detached shards near the button instead of reading as a smear.
      const lagIdx = planes.length - 1 - i;
      const gu = u - lagIdx * 0.016;
      const speed = smooth(0.22, 0.6, u); // trail belongs to the fast exit only
      if (gu <= 0.03 || speed <= 0) {
        planes[i]!.alpha = 0;
        continue;
      }
      placePlane(planes[i]!, gu, 0.24 * speed * (1 - lagIdx / (TRAIL + 1)));
    }
  };

  return { timeline, duration: DURATION, update };
}

export const flightMode: TemplateDefinition = {
  id: "flight-mode",
  name: "Flight Mode",
  tagline: "The Control Center drops in, Flight Mode thumps on, and the plane takes off — your travel vlog begins.",
  category: "travel",
  // Filed under travel, but it is an opener: it should swell and land, not
  // tinkle politely like a postcard.
  sound: "cinematic",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 5.0,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Off to Tokyo", maxLength: 34, shrinkToFit: true, optional: true },
    { key: "subline", type: "text", label: "Subline", default: "A travel film · Part 1", maxLength: 44, shrinkToFit: true, optional: true },
    { key: "label", type: "text", label: "Status label", default: "Flight Mode: On", maxLength: 24, shrinkToFit: true, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "panelColor", type: "color", label: "Panel", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Flight Mode color", default: "", optional: true },
    { key: "showLabel", type: "toggle", label: "Status pill", default: true },
    { key: "showShadow", type: "toggle", label: "Soft shadow", default: true },
  ],
  build,
};
