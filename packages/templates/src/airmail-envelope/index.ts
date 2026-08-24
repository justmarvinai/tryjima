import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inQuad,
  inCubic,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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

/** Darken a #rrggbb color by factor f (0..1). */
function shade(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  let out = "#";
  for (const i of [0, 2, 4]) {
    const v = Math.max(0, Math.min(255, Math.round(parseInt(n.slice(i, i + 2), 16) * f)));
    out += v.toString(16).padStart(2, "0");
  }
  return out;
}

// The airmail chevron stripes are semantically red/blue regardless of palette
// (like postal envelopes everywhere); the invite text uses textColor on the
// paper card (>= 4.5:1 per palette), the postmark + kicker use accent.
const AIRMAIL_RED = "#BF3B2B";
const AIRMAIL_BLUE = "#2E4F9E";

const PALETTES: Palette[] = [
  { id: "postal-cream", name: "Postal cream", colors: { background: "#F1EAD8", envColor: "#F7F1E1", paperColor: "#FDFAF0", textColor: "#2A2118", accent: "#B33A2B" } },
  { id: "midnight-post", name: "Midnight post", colors: { background: "#131722", envColor: "#EFE9D8", paperColor: "#F6F1E4", textColor: "#2A2118", accent: "#3D63C9" } },
  { id: "sky-mail", name: "Sky mail", colors: { background: "#E4EFF7", envColor: "#F6F9FC", paperColor: "#FFFFFF", textColor: "#1C2733", accent: "#2F5FA8" } },
  { id: "rose-rsvp", name: "Rose RSVP", colors: { background: "#F8E9EC", envColor: "#FDF6EE", paperColor: "#FFFDF8", textColor: "#33181E", accent: "#A9314D" } },
];

const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F1EAD8"));
  const envColor = pc("envColor", "#F7F1E1");
  const paperColor = pc("paperColor", "#FDFAF0");
  const textColor = str(values.textColor, pc("textColor", "#2A2118"));
  const accent = str(values.accent, pc("accent", "#B33A2B"));

  const title = str(values.title, "Garden Party");
  const date = str(values.date, "Sat, Aug 22 · 6 PM");
  const kickerRaw = str(values.kicker, "YOU'RE INVITED").toUpperCase();
  const showStripes = values.showStripes !== false;
  const showStamp = values.showStamp !== false;
  const showPostmark = values.showPostmark !== false;
  const showAddress = values.showAddress !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Envelope geometry (group origin = envelope center) ---
  const envW = Math.min(zone.width * 0.86, minDim * 0.62, zone.height * 0.55 / 0.64);
  const envH = envW * 0.64;
  const flapDepth = envH * 0.46;
  const cardW = envW * 0.78;
  const cardH = envH * 0.92;
  const envTop = -envH / 2;
  const cardRestY = 0; // fully inside the envelope
  const cardUpY = envTop - cardH / 2 + envH * 0.3; // bottom third stays pocketed

  const group = new Container();
  const groupX = zone.x + zone.width / 2;
  const groupY = zone.y + zone.height / 2 + envH * 0.31;
  group.position.set(groupX, groupY);
  group.alpha = 0;
  root.addChild(group);

  // Soft shadow under the envelope.
  const shadowPad = envH * 0.02;
  group.addChild(
    new Graphics()
      .roundRect(-envW / 2 - shadowPad, envTop - shadowPad + envH * 0.06, envW + shadowPad * 2, envH + shadowPad * 2, envH * 0.05)
      .fill({ color: "#000000", alpha: 0.16 }),
  );

  // --- Open flap (behind the card; grows upward once the closed flap folds) ---
  const flapOpen = new Container();
  flapOpen.position.set(0, envTop);
  flapOpen.scale.set(1, 0);
  group.addChild(flapOpen);
  const foG = new Graphics()
    .poly([-envW / 2, 0, envW / 2, 0, 0, -flapDepth])
    .fill(shade(envColor, 0.8));
  foG.moveTo(-envW * 0.42, -flapDepth * 0.09)
    .lineTo(0, -flapDepth * 0.86)
    .lineTo(envW * 0.42, -flapDepth * 0.09)
    .stroke({ color: accent, width: Math.max(2, envH * 0.008), alpha: 0.35 });
  flapOpen.addChild(foG);

  // --- Invite card (rises out from behind the face) ---
  const card = new Container();
  card.position.set(0, cardRestY);
  group.addChild(card);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2, -cardH / 2, cardW, cardH, envH * 0.04)
      .fill(paperColor)
      .roundRect(-cardW / 2, -cardH / 2, cardW, cardH, envH * 0.04)
      .stroke({ color: textColor, width: 1.5, alpha: 0.12 }),
  );

  const kickerSize = fitSize(fonts, kickerRaw, "body", 700, Math.round(envH * 0.052), cardW * 0.55);
  const kicker = makeText(fonts, { text: kickerRaw, role: "body", weight: 700, size: kickerSize, color: accent, anchor: 0.5, letterSpacing: 4 });
  const kickerY = -cardH * 0.3;
  kicker.position.set(0, kickerY);
  kicker.alpha = 0;
  card.addChild(kicker);

  const titleSize = fitSize(fonts, title, "serif", 600, Math.round(envH * 0.14), cardW * 0.86);
  const titleText = makeText(fonts, { text: title, role: "serif", weight: 600, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  const titleY = -cardH * 0.1;
  titleText.position.set(0, titleY);
  titleText.alpha = 0;
  card.addChild(titleText);

  const dateSize = fitSize(fonts, date, "body", 500, Math.round(envH * 0.058), cardW * 0.8);
  const dateText = makeText(fonts, { text: date, role: "body", weight: 500, size: dateSize, color: textColor, anchor: 0.5 });
  const dateY = envH * 0.06;
  dateText.position.set(0, dateY);
  dateText.alpha = 0;
  card.addChild(dateText);

  // --- Envelope face (covers the card while it is inside) ---
  const face = new Container();
  group.addChild(face);
  face.addChild(
    new Graphics()
      .roundRect(-envW / 2, envTop, envW, envH, envH * 0.03)
      .fill(envColor)
      .roundRect(-envW / 2, envTop, envW, envH, envH * 0.03)
      .stroke({ color: textColor, width: 1.5, alpha: 0.18 }),
  );

  if (showStripes) {
    const bt = envH * 0.055;
    const seg = envW * 0.052;
    const gap = seg * 0.55;
    const stripes = new Graphics();
    const paint = (i: number): string => (i % 2 === 0 ? AIRMAIL_RED : AIRMAIL_BLUE);
    // Top + bottom edges.
    for (const y of [envTop, envTop + envH - bt]) {
      let x = -envW / 2;
      let i = 0;
      while (x < envW / 2) {
        const len = Math.min(seg, envW / 2 - x);
        stripes.rect(x, y, len, bt).fill(paint(i));
        x += seg + gap;
        i++;
      }
    }
    // Left + right edges (between the horizontal bands).
    for (const x of [-envW / 2, envW / 2 - bt]) {
      let y = envTop + bt + gap;
      let i = 1;
      while (y < envTop + envH - bt - gap * 0.5) {
        const len = Math.min(seg, envTop + envH - bt - y);
        if (len > gap * 0.4) stripes.rect(x, y, bt, len).fill(paint(i));
        y += seg + gap;
        i++;
      }
    }
    face.addChild(stripes);
  } else {
    face.addChild(
      new Graphics()
        .roundRect(-envW / 2 + envH * 0.04, envTop + envH * 0.04, envW - envH * 0.08, envH - envH * 0.08, envH * 0.02)
        .stroke({ color: accent, width: Math.max(2, envH * 0.01), alpha: 0.5 }),
    );
  }

  if (showAddress) {
    const lines = new Graphics();
    const lineH = Math.max(3, envH * 0.02);
    const widths = [0.34, 0.26, 0.3];
    widths.forEach((f, i) => {
      lines.roundRect(-envW * 0.3, envH * (0.0 + i * 0.075), envW * f, lineH, lineH / 2).fill({ color: textColor, alpha: 0.22 });
    });
    face.addChild(lines);

    const viaSize = Math.round(envH * 0.05);
    const via = makeText(fonts, { text: "VIA AIR MAIL", role: "body", weight: 700, size: viaSize, color: accent, anchor: { x: 1, y: 0.5 }, letterSpacing: 3 });
    via.position.set(envW * 0.41, envH * 0.33);
    via.alpha = 0.85;
    face.addChild(via);
  }

  if (showStamp) {
    const stampW = envW * 0.15;
    const stampH = envH * 0.28;
    const stampCx = envW * 0.32;
    const stampCy = envTop + envH * 0.3;
    const stamp = new Container();
    stamp.position.set(stampCx, stampCy);
    stamp.rotation = 0.05;
    face.addChild(stamp);
    stamp.addChild(new Graphics().rect(-stampW / 2, -stampH / 2, stampW, stampH).fill(paperColor));
    const perf = new Graphics();
    dashedPath(
      perf,
      [-stampW / 2, -stampH / 2, stampW / 2, -stampH / 2, stampW / 2, stampH / 2, -stampW / 2, stampH / 2, -stampW / 2, -stampH / 2],
      { dash: stampW * 0.08, gap: stampW * 0.07, width: Math.max(2, stampW * 0.04), color: accent },
    );
    perf.alpha = 0.5;
    stamp.addChild(perf);
    const plane = makeIcon("plane", stampW * 0.52, { color: accent });
    plane.position.set(0, -stampH * 0.06);
    stamp.addChild(plane);
    stamp.addChild(
      new Graphics().roundRect(-stampW * 0.3, stampH * 0.26, stampW * 0.6, Math.max(2.5, stampH * 0.035), 2).fill({ color: accent, alpha: 0.55 }),
    );
  }

  // --- Closed flap (folds up out of view; topmost on the face) ---
  const flapClosed = new Container();
  flapClosed.position.set(0, envTop);
  face.addChild(flapClosed);
  const fcG = new Graphics()
    .poly([-envW / 2, 0, envW / 2, 0, 0, flapDepth])
    .fill(shade(envColor, 0.95));
  fcG.moveTo(-envW / 2, 0)
    .lineTo(0, flapDepth)
    .lineTo(envW / 2, 0)
    .stroke({ color: textColor, width: 1.5, alpha: 0.2 });
  flapClosed.addChild(fcG);

  // --- Postmark (stamps onto the risen card, top-right) ---
  if (showPostmark) {
    const pr = envH * 0.115;
    const mark = new Container();
    mark.position.set(cardW * 0.35, cardUpY - cardH / 2 + envH * 0.02);
    mark.rotation = -0.22;
    mark.alpha = 0;
    group.addChild(mark);
    const mg = new Graphics()
      .circle(0, 0, pr)
      .stroke({ color: accent, width: Math.max(2.5, pr * 0.09) })
      .circle(0, 0, pr * 0.72)
      .stroke({ color: accent, width: Math.max(1.5, pr * 0.05) });
    for (const oy of [-0.32, 0, 0.32]) {
      mg.moveTo(pr * 1.15, pr * oy)
        .quadraticCurveTo(pr * 1.6, pr * (oy - 0.14), pr * 2.05, pr * oy)
        .stroke({ color: accent, width: Math.max(2, pr * 0.07), cap: "round" });
    }
    mark.addChild(mg);
    const pmSize = Math.max(9, Math.round(pr * 0.26));
    const pmText = makeText(fonts, { text: "AIR MAIL", role: "body", weight: 700, size: pmSize, color: accent, anchor: 0.5, letterSpacing: 1 });
    mark.addChild(pmText);

    timeline
      .to(mark, { prop: "alpha", from: 0, to: 0.9, start: 3.0, duration: 0.12, ease: outQuad })
      .to(mark, { prop: "scale.x", from: 1.9, to: 1, start: 3.0, duration: 0.22, ease: inCubic })
      .to(mark, { prop: "scale.y", from: 1.9, to: 1, start: 3.0, duration: 0.22, ease: inCubic })
      .to(mark, { prop: "scale.x", from: 1, to: 1.06, start: 3.22, duration: 0.1, ease: outQuad })
      .to(mark, { prop: "scale.y", from: 1, to: 1.06, start: 3.22, duration: 0.1, ease: outQuad })
      .to(mark, { prop: "scale.x", from: 1.06, to: 1, start: 3.32, duration: 0.18, ease: outQuad })
      .to(mark, { prop: "scale.y", from: 1.06, to: 1, start: 3.32, duration: 0.18, ease: outQuad })
      .to(mark, { prop: "rotation", from: -0.5, to: -0.22, start: 3.0, duration: 0.22, ease: inCubic });
  }

  // --- Motion ---
  timeline
    .to(group, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.35, ease: outQuad })
    .to(group, { prop: "y", from: groupY + h * 0.16, to: groupY, start: 0.05, duration: 0.7, ease: outQuint })
    .to(group, { prop: "rotation", from: -0.045, to: 0, start: 0.05, duration: 0.8, ease: outQuint })
    .to(flapClosed, { prop: "scale.y", from: 1, to: 0, start: 0.95, duration: 0.3, ease: inQuad })
    .to(flapOpen, { prop: "scale.y", from: 0, to: 1, start: 1.25, duration: 0.35, ease: makeOutBack(1.2) })
    .to(card, { prop: "y", from: cardRestY, to: cardUpY, start: 1.75, duration: 0.8, ease: outQuint })
    .to(kicker, { prop: "alpha", from: 0, to: 1, start: 2.2, duration: 0.4, ease: outQuad })
    .to(kicker, { prop: "y", from: kickerY + 10, to: kickerY, start: 2.2, duration: 0.45, ease: outQuint })
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 2.35, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 12, to: titleY, start: 2.35, duration: 0.5, ease: outQuint })
    .to(dateText, { prop: "alpha", from: 0, to: 0.85, start: 2.55, duration: 0.45, ease: outQuad })
    .to(dateText, { prop: "y", from: dateY + 10, to: dateY, start: 2.55, duration: 0.5, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const airmailEnvelope: TemplateDefinition = {
  id: "airmail-envelope",
  name: "Airmail Invite",
  tagline: "An airmail envelope opens and the invite rises out, stamped with a postmark.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { title: "serif", kicker: "body", date: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Event title", default: "Garden Party", maxLength: 26, shrinkToFit: true },
    { key: "date", type: "text", label: "Date line", default: "Sat, Aug 22 · 6 PM", maxLength: 26, shrinkToFit: true },
    { key: "kicker", type: "text", label: "Kicker", default: "YOU'RE INVITED", maxLength: 20, shrinkToFit: true },
    { key: "showStripes", type: "toggle", label: "Airmail stripes", default: true },
    { key: "showStamp", type: "toggle", label: "Postage stamp", default: true },
    { key: "showPostmark", type: "toggle", label: "Postmark", default: true },
    { key: "showAddress", type: "toggle", label: "Address lines", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
