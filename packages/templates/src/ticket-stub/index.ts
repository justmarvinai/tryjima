import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const DEG = Math.PI / 180;

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "boxoffice", name: "Box office cream", colors: { background: "#F6EFE0", cardColor: "#FFFFFF", textColor: "#241A0E", accent: "#C81E3A" } },
  { id: "backstage", name: "Backstage noir", colors: { background: "#14131A", cardColor: "#201E27", textColor: "#F5F1E6", accent: "#E7B95C" } },
  { id: "festival", name: "Festival punch", colors: { background: "#FFEFF5", cardColor: "#FFFFFF", textColor: "#2B0E24", accent: "#C81361" } },
  { id: "pitch", name: "Pitch rust", colors: { background: "#EAF3E7", cardColor: "#FFFFFF", textColor: "#0F2418", accent: "#C2540A" } },
];

interface L {
  tw: number;
  th: number;
  cy: number;
}

function layout(aspect: Aspect, w: number, h: number): L {
  const f: Record<Aspect, { tw: number; th: number; cy: number }> = {
    "1:1": { tw: 0.8, th: 0.4, cy: 0.46 },
    "4:5": { tw: 0.82, th: 0.4, cy: 0.43 },
    "9:16": { tw: 0.84, th: 0.42, cy: 0.4 },
    "16:9": { tw: 0.54, th: 0.28, cy: 0.48 },
  };
  const b = f[aspect];
  return { tw: w * b.tw, th: w * b.th, cy: h * b.cy };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6EFE0"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#241A0E"));
  const accent = str(values.accent, pc("accent", "#C81E3A"));
  const showPerforation = values.showPerforation !== false;

  const eventName = str(values.eventName, "Neon Nights Live");
  const dateVal = str(values.date, "SAT · SEP 12");
  const venueVal = str(values.venue, "The Grand Hall");
  const seatVal = str(values.seat, "GA");

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const { tw, th, cy } = layout(ctx.aspect, w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const stubFrac = 0.27;
  const perfX = tw / 2 - tw * stubFrac;
  const pad = tw * 0.045;
  const radius = th * 0.09;
  const notchR = th * 0.085;
  const overlap = Math.max(2, tw * 0.006);

  // --- The ticket assembly (slides in as one unit) ---
  const ticket = new Container();
  const startX = -(w / 2 + tw / 2 + minDim * 0.05);
  ticket.position.set(cx + startX, cy);
  ticket.rotation = -3 * DEG;
  root.addChild(ticket);

  // Main body (left of the perforation) — stays put.
  const backCard = new Graphics().roundRect(-tw / 2, -th / 2, perfX + tw / 2, th, radius).fill(cardColor);
  ticket.addChild(backCard);

  // Perforation: dotted vertical line + punched notch circles top/bottom.
  let perfDots: Graphics | null = null;
  let notchTop: Graphics | null = null;
  let notchBottom: Graphics | null = null;
  if (showPerforation) {
    perfDots = new Graphics();
    dashedPath(perfDots, [perfX, -th / 2 + notchR * 1.1, perfX, th / 2 - notchR * 1.1], {
      dash: 8,
      gap: 7,
      width: Math.max(2, minDim * 0.005),
      color: accent,
      cap: "round",
    });
    perfDots.alpha = 0;
    ticket.addChild(perfDots);

    notchTop = new Graphics().circle(perfX, -th / 2, notchR).fill(bg);
    notchBottom = new Graphics().circle(perfX, th / 2, notchR).fill(bg);
    notchTop.scale.set(0);
    notchBottom.scale.set(0);
    ticket.addChild(notchTop, notchBottom);
  }

  // Stub (right of the perforation) — a separate node so it can tear away.
  const stub = new Container();
  ticket.addChild(stub);
  const stubCard = new Graphics()
    .roundRect(perfX - overlap, -th / 2, tw / 2 - perfX + overlap, th, radius)
    .fill(cardColor);
  stub.addChild(stubCard);
  const stubMidX = (perfX + tw / 2) / 2;
  const stubLabel = `SEAT · ${seatVal}`.toUpperCase();
  const stubSize = fitSize(fonts, stubLabel, "body", 600, Math.round(th * 0.072), th * 0.8, 2);
  const stubText = makeText(fonts, {
    text: stubLabel,
    role: "body",
    weight: 600,
    size: stubSize,
    color: accent,
    anchor: 0.5,
    letterSpacing: 2,
  });
  stubText.position.set(stubMidX, 0);
  stubText.rotation = -90 * DEG;
  stub.addChild(stubText);

  // --- Content the tear "reveals" ---
  const mainLeft = -tw / 2 + pad;
  const mainRight = perfX - pad * 0.7;
  const mainW = Math.max(10, mainRight - mainLeft);

  const nameSize = fitSize(fonts, eventName, "display", 700, Math.round(th * 0.24), mainW);
  const nameY = -th * 0.22;
  const nameText = makeText(fonts, { text: eventName, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(mainLeft, nameY);
  nameText.alpha = 0;
  ticket.addChild(nameText);

  const cols: { key: string; val: string }[] = [
    { key: "DATE", val: dateVal },
    { key: "VENUE", val: venueVal },
    { key: "SEAT", val: seatVal },
  ];
  const colW = mainW / cols.length;
  const labelSize = Math.round(th * 0.07);
  const valueSize = Math.round(th * 0.11);
  const labelY = th * 0.11;
  const valueY = th * 0.27;

  const infoHolders: Container[] = cols.map((col, i) => {
    const colLeft = mainLeft + i * colW;
    const holder = new Container();
    holder.alpha = 0;

    const lblSize = fitSize(fonts, col.key, "body", 600, labelSize, colW * 0.92, 1.5);
    const lbl = makeText(fonts, { text: col.key, role: "body", weight: 600, size: lblSize, color: accent, anchor: { x: 0, y: 0.5 }, letterSpacing: 1.5 });
    lbl.position.set(colLeft, labelY);
    holder.addChild(lbl);

    const valSize = fitSize(fonts, col.val, "display", 700, valueSize, colW * 0.92);
    const val = makeText(fonts, { text: col.val, role: "display", weight: 700, size: valSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    val.position.set(colLeft, valueY);
    holder.addChild(val);

    ticket.addChild(holder);
    return holder;
  });

  // --- Timeline ---
  const slideDur = 0.6;
  timeline
    .to(ticket, { prop: "x", from: cx + startX, to: cx, start: 0, duration: slideDur, ease: makeOutBack(1.25) })
    .to(ticket, { prop: "rotation", from: -3 * DEG, to: 0, start: 0, duration: slideDur, ease: outExpo });

  if (showPerforation && perfDots && notchTop && notchBottom) {
    const perfStart = 0.52;
    timeline
      .to(perfDots, { prop: "alpha", from: 0, to: 1, start: perfStart, duration: 0.3, ease: outQuad })
      .to(notchTop, { prop: "scale.x", from: 0, to: 1, start: perfStart, duration: 0.35, ease: makeOutBack(2.2) })
      .to(notchTop, { prop: "scale.y", from: 0, to: 1, start: perfStart, duration: 0.35, ease: makeOutBack(2.2) })
      .to(notchBottom, { prop: "scale.x", from: 0, to: 1, start: perfStart + 0.05, duration: 0.35, ease: makeOutBack(2.2) })
      .to(notchBottom, { prop: "scale.y", from: 0, to: 1, start: perfStart + 0.05, duration: 0.35, ease: makeOutBack(2.2) });

    const tearStart = 0.85;
    timeline
      .to(stub, { prop: "rotation", from: 0, to: 7 * DEG, start: tearStart, duration: 0.45, ease: makeOutBack(1.4) })
      .to(stub, { prop: "x", from: 0, to: tw * 0.045, start: tearStart, duration: 0.45, ease: outQuad })
      .to(stub, { prop: "y", from: 0, to: th * 0.05, start: tearStart, duration: 0.45, ease: outQuad });
  }

  const nameStart = 1.0;
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: nameStart, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 16, to: nameY, start: nameStart, duration: 0.45, ease: outQuint });

  const infoStart = 1.2;
  const infoStagger = 0.13;
  infoHolders.forEach((holder, i) => {
    const start = infoStart + i * infoStagger;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(holder, { prop: "y", from: 14, to: 0, start, duration: 0.45, ease: outQuint });
  });

  return { timeline, duration: 3.4 };
}

export const ticketStub: TemplateDefinition = {
  id: "ticket-stub",
  name: "Ticket Stub",
  tagline: "An event ticket slides in and its stub tears away to reveal the details.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { eventName: "display" },
  palettes: PALETTES,
  fields: [
    { key: "eventName", type: "text", label: "Event name", default: "Neon Nights Live", maxLength: 32, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "SAT · SEP 12", maxLength: 20 },
    { key: "venue", type: "text", label: "Venue", default: "The Grand Hall", maxLength: 32, shrinkToFit: true },
    { key: "seat", type: "text", label: "Seat", default: "GA", maxLength: 12 },
    { key: "showPerforation", type: "toggle", label: "Perforation & tear", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
