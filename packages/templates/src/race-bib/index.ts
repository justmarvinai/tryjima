import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

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

function relLum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrastRatio = (a: string, b: string): number => {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const readableOn = (bg: string): string =>
  contrastRatio("#FFFFFF", bg) >= contrastRatio("#111318", bg) * 0.9 ? "#FFFFFF" : "#111318";

// The pins are always brushed metal (semantic, like real safety pins); race
// name + number use textColor on the bib card (>= 4.5:1 per palette).
const PIN_WIRE = "#8A919B";
const PIN_CLASP = "#6E7580";

const PALETTES: Palette[] = [
  { id: "classic-red", name: "Classic red", colors: { background: "#EFF2F6", cardBg: "#FFFFFF", textColor: "#14181E", accent: "#C4271C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#12151C", cardBg: "#1D2230", textColor: "#F3F5F9", accent: "#4FC3F7" } },
  { id: "forest", name: "Forest", colors: { background: "#ECF3EC", cardBg: "#FFFFFF", textColor: "#14251A", accent: "#1F6B3C" } },
  { id: "ember", name: "Ember", colors: { background: "#FFF0E2", cardBg: "#FFFFFF", textColor: "#33170A", accent: "#A63E12" } },
];

/** A simplified closed safety pin, horizontal, centered at (0,0). */
function makePin(s: number): Container {
  const c = new Container();
  const g = new Graphics();
  const lw = Math.max(3, s * 0.055);
  g.circle(-s * 0.42, 0, s * 0.1).stroke({ color: PIN_WIRE, width: lw });
  g.moveTo(-s * 0.34, s * 0.05)
    .quadraticCurveTo(0, s * 0.15, s * 0.42, s * 0.04)
    .stroke({ color: PIN_WIRE, width: lw, cap: "round" });
  g.moveTo(-s * 0.34, -s * 0.05)
    .lineTo(s * 0.37, -s * 0.05)
    .stroke({ color: PIN_WIRE, width: lw, cap: "round" });
  g.roundRect(s * 0.34, -s * 0.12, s * 0.16, s * 0.21, s * 0.05).fill(PIN_CLASP);
  c.addChild(g);
  return c;
}

const COUNT_START = 1.1;
const COUNT_DUR = 1.3;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EFF2F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#14181E"));
  const accent = str(values.accent, pc("accent", "#C4271C"));
  const stripInk = readableOn(accent);

  const race = str(values.race, "RIVERSIDE MARATHON").toUpperCase();
  const target = Math.max(0, Math.round(parseTargetNumber(str(values.value, "1847"))));
  const targetStr = String(target);
  const date = str(values.date, "SUN 04 OCT · 7:00 AM").toUpperCase();
  const showPins = values.showPins !== false;
  const showPerforation = values.showPerforation !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Bib card ---
  const bibW = Math.min(zone.width * 0.9, minDim * 0.66);
  const bibH = bibW * 0.78;
  const bib = new Container();
  bib.position.set(cx, cy);
  bib.alpha = 0;
  root.addChild(bib);

  const e = Math.round(bibH * 0.022);
  const corner = bibW * 0.045;
  bib.addChild(
    new Graphics()
      .roundRect(-bibW / 2 - e, -bibH / 2 - e + bibH * 0.03, bibW + e * 2, bibH + e * 2, corner + e)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  bib.addChild(
    new Graphics()
      .roundRect(-bibW / 2, -bibH / 2, bibW, bibH, corner)
      .fill(cardBg)
      .roundRect(-bibW / 2, -bibH / 2, bibW, bibH, corner)
      .stroke({ color: textColor, width: 2, alpha: 0.1 }),
  );

  timeline
    .to(bib, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.4, ease: outQuad })
    .to(bib, { prop: "y", from: cy + h * 0.09, to: cy, start: 0.05, duration: 0.65, ease: outQuint })
    .to(bib, { prop: "rotation", from: 0.035, to: 0, start: 0.05, duration: 0.7, ease: outQuint });

  // --- Date strip (bottom band) ---
  const stripW = bibW * 0.84;
  const stripH = bibH * 0.135;
  const stripCy = bibH / 2 - stripH / 2 - bibH * 0.055;
  const strip = new Container();
  strip.position.set(0, stripCy);
  strip.scale.set(0, 1);
  bib.addChild(strip);
  strip.addChild(new Graphics().roundRect(-stripW / 2, -stripH / 2, stripW, stripH, stripH * 0.3).fill(accent));
  const dateSize = fitSize(fonts, date, "body", 700, Math.round(stripH * 0.42), stripW * 0.9);
  const dateText = makeText(fonts, { text: date, role: "body", weight: 700, size: dateSize, color: stripInk, anchor: 0.5, letterSpacing: 2 });
  strip.addChild(dateText);
  timeline.to(strip, { prop: "scale.x", from: 0, to: 1, start: 0.8, duration: 0.5, ease: outExpo });

  // --- Perforated edge dots (punched in the bib's own background color) ---
  if (showPerforation) {
    const dots = new Graphics();
    const r = Math.max(3.5, bibW * 0.0095);
    const span = bibW * 0.88;
    const nDots = 19;
    const topY = -bibH / 2 + bibH * 0.038;
    const bottomY = stripCy - stripH / 2 - bibH * 0.042;
    for (let i = 0; i < nDots; i++) {
      const x = -span / 2 + (span * i) / (nDots - 1);
      dots.circle(x, topY, r).fill(bg);
      dots.circle(x, bottomY, r).fill(bg);
    }
    dots.alpha = 0;
    bib.addChild(dots);
    timeline.to(dots, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad });
  }

  // --- Race name + flanking accent marks ---
  const raceSize = fitSize(fonts, race, "display", 700, Math.round(minDim * 0.036), bibW * 0.72);
  const raceY = -bibH * 0.33;
  const raceText = makeText(fonts, { text: race, role: "display", weight: 700, size: raceSize, color: textColor, anchor: 0.5, letterSpacing: 2 });
  raceText.position.set(0, raceY);
  raceText.alpha = 0;
  bib.addChild(raceText);
  const raceW = fonts.measure(race, { family: fonts.family("display"), weight: 700, size: raceSize }) + raceSize * 0.2;
  const markW = bibW * 0.05;
  const markH = Math.max(3, raceSize * 0.14);
  const marks = new Graphics()
    .roundRect(-raceW / 2 - bibW * 0.03 - markW, raceY - markH / 2, markW, markH, markH / 2)
    .fill(accent)
    .roundRect(raceW / 2 + bibW * 0.03, raceY - markH / 2, markW, markH, markH / 2)
    .fill(accent);
  marks.alpha = 0;
  bib.addChild(marks);
  timeline
    .to(raceText, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.4, ease: outQuad })
    .to(raceText, { prop: "y", from: raceY + 10, to: raceY, start: 0.6, duration: 0.5, ease: outQuint })
    .to(marks, { prop: "alpha", from: 0, to: 1, start: 0.75, duration: 0.4, ease: outQuad });

  // --- The big bib number (counts up in update) ---
  const numSize = fitSize(fonts, targetStr, "display", 700, Math.round(bibW * 0.3), bibW * 0.8);
  const numY = 0;
  const numText = makeText(fonts, { text: "0", role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5 });
  numText.position.set(0, numY);
  numText.alpha = 0;
  bib.addChild(numText);
  timeline
    .to(numText, { prop: "alpha", from: 0, to: 1, start: 1.0, duration: 0.3, ease: outQuad })
    .to(numText, { prop: "scale.x", from: 1, to: 1.06, start: 2.4, duration: 0.12, ease: outQuad })
    .to(numText, { prop: "scale.y", from: 1, to: 1.06, start: 2.4, duration: 0.12, ease: outQuad })
    .to(numText, { prop: "scale.x", from: 1.06, to: 1, start: 2.52, duration: 0.2, ease: outQuad })
    .to(numText, { prop: "scale.y", from: 1.06, to: 1, start: 2.52, duration: 0.2, ease: outQuad });

  // --- Safety pins thunk into the top corners; the bib wobbles on landing ---
  if (showPins) {
    const pinS = bibW * 0.24;
    const holes = new Graphics();
    const holeY = -bibH / 2 + bibH * 0.075;
    for (const sx of [-1, 1]) holes.circle(sx * bibW * 0.33, holeY, bibW * 0.014).fill(bg);
    holes.alpha = 0;
    bib.addChild(holes);
    timeline.to(holes, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad });

    const pinDefs = [
      { sx: -1, at: 2.85, rot: -0.3 },
      { sx: 1, at: 3.15, rot: 0.26 },
    ];
    for (const d of pinDefs) {
      const pin = makePin(pinS);
      pin.position.set(d.sx * bibW * 0.33, holeY - bibH * 0.018);
      pin.rotation = d.rot;
      pin.scale.set(0);
      bib.addChild(pin);
      timeline
        .to(pin, { prop: "scale.x", from: 0, to: 1, start: d.at, duration: 0.4, ease: makeOutBack(2.2) })
        .to(pin, { prop: "scale.y", from: 0, to: 1, start: d.at, duration: 0.4, ease: makeOutBack(2.2) });
    }
    // Paper wobble: one small kick per pin landing, settling to rest.
    timeline
      .to(bib, { prop: "rotation", from: 0, to: -0.013, start: 3.0, duration: 0.1, ease: outQuad })
      .to(bib, { prop: "rotation", from: -0.013, to: 0.007, start: 3.1, duration: 0.12, ease: outQuad })
      .to(bib, { prop: "rotation", from: 0.007, to: 0, start: 3.22, duration: 0.14, ease: outQuad })
      .to(bib, { prop: "rotation", from: 0, to: 0.011, start: 3.3, duration: 0.1, ease: outQuad })
      .to(bib, { prop: "rotation", from: 0.011, to: -0.005, start: 3.4, duration: 0.12, ease: outQuad })
      .to(bib, { prop: "rotation", from: -0.005, to: 0, start: 3.52, duration: 0.18, ease: outQuad });
  }

  const update = (t: number): void => {
    const p = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
    numText.text = String(Math.round(target * p));
  };

  return { timeline, duration: DURATION, update };
}

export const raceBib: TemplateDefinition = {
  id: "race-bib",
  name: "Race Bib",
  tagline: "A marathon bib counts up its number, then gets pinned on with a paper wobble.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { race: "display", value: "display", date: "body" },
  palettes: PALETTES,
  fields: [
    { key: "race", type: "text", label: "Race name", default: "RIVERSIDE MARATHON", maxLength: 26, shrinkToFit: true },
    { key: "value", type: "text", label: "Bib number", default: "1847", maxLength: 6, help: "Counts up from zero." },
    { key: "date", type: "text", label: "Date strip", default: "SUN 04 OCT · 7:00 AM", maxLength: 26, shrinkToFit: true },
    { key: "showPins", type: "toggle", label: "Safety pins", default: true },
    { key: "showPerforation", type: "toggle", label: "Perforated edge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
