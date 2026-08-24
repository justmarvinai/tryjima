import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  spring,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { avatar, makePill } from "../shared/ui";

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

/** Greedy-wrap into <= maxLines lines, then shrink so the widest line fits. */
function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(13, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

// Relative luminance (WCAG) → pick a readable ink for text sitting ON `bg`.
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
// Pick the ink (white / near-black) with the most contrast on `bg`, preferring
// white unless near-black is clearly better — keeps CTA/badge labels legible.
const readableOn = (bg: string): string =>
  contrastRatio("#FFFFFF", bg) >= contrastRatio("#111318", bg) * 0.9 ? "#FFFFFF" : "#111318";

// Fixed, deep avatar hues that always carry white initials (>= 4.5:1) — purely
// decorative, so independent of the chosen brand palette.
const AVATAR_BG = ["#2F5EA8", "#7A3E9D", "#146B5B", "#9A4A22"];

const PALETTES: Palette[] = [
  { id: "live-light", name: "Live light", colors: { background: "#F4F6FB", cardBg: "#FFFFFF", textColor: "#0E1526", accent: "#D42A3C" } },
  { id: "aurora", name: "Aurora", colors: { background: "#0E1220", cardBg: "#1A2033", textColor: "#F2F5FC", accent: "#5B8DEF" } },
  { id: "grape", name: "Grape", colors: { background: "#F6F1FB", cardBg: "#FFFFFF", textColor: "#1E1030", accent: "#7A3DF6" } },
  { id: "emerald", name: "Emerald", colors: { background: "#EEF7F1", cardBg: "#FFFFFF", textColor: "#08231A", accent: "#12855A" } },
];

const DEFAULT_HOSTS = ["Ava Chen", "Marco Diaz", "Priya Rao"];
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FB"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0E1526"));
  const accent = str(values.accent, pc("accent", "#D42A3C"));
  const accentInk = readableOn(accent);

  const title = str(values.title, "Scaling Design Systems");
  const date = str(values.date, "Thu Aug 14 · 5PM");
  const cta = str(values.cta, "Register free");
  const hosts = asList(values.hosts, DEFAULT_HOSTS).slice(0, 3);
  const showKicker = on(values.showKicker);
  const showHosts = on(values.showHosts);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const maxW = zone.width * 0.94;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Pre-measure every block so the stack can be vertically centered ---
  const gap = minDim * 0.038;

  const kickerH = minDim * 0.052;
  const kickerLabel = "LIVE WEBINAR";
  const kickerFont = Math.round(minDim * 0.026);

  const titleFont0 = Math.round(minDim * 0.074);
  const { lines: titleLines, size: titleFont } = wrapAndFit(fonts, title, "display", 700, titleFont0, maxW, 2);
  const titleLH = Math.round(titleFont * 1.1);
  const titleH = titleLines.length * titleLH;

  const dateH = Math.round(minDim * 0.062);
  const dateFont = Math.round(minDim * 0.03);

  const avR = Math.round(minDim * 0.05);
  const hostGap = Math.round(minDim * 0.03);
  const hostNameFont = Math.round(minDim * 0.023);
  const hostCellW = avR * 2 + hostGap;
  const hostsRowW = hosts.length * avR * 2 + (hosts.length - 1) * hostGap;
  const hostsH = showHosts && hosts.length > 0 ? avR * 2 + minDim * 0.02 + hostNameFont : 0;

  const btnH = Math.round(minDim * 0.078);
  const btnFont = Math.round(minDim * 0.032);

  interface Block {
    key: "kicker" | "title" | "date" | "hosts" | "button";
    h: number;
  }
  const blocks: Block[] = [];
  if (showKicker) blocks.push({ key: "kicker", h: kickerH });
  blocks.push({ key: "title", h: titleH });
  blocks.push({ key: "date", h: dateH });
  if (showHosts && hosts.length > 0) blocks.push({ key: "hosts", h: hostsH });
  blocks.push({ key: "button", h: btnH });

  const totalH = blocks.reduce((s, b) => s + b.h, 0) + (blocks.length - 1) * gap;
  let cursorY = zone.y + zone.height / 2 - totalH / 2;
  const centers: Record<string, number> = {};
  blocks.forEach((b, i) => {
    centers[b.key] = cursorY + b.h / 2;
    cursorY += b.h + (i < blocks.length - 1 ? gap : 0);
  });

  let order = 0;
  const nextStart = (): number => 0.1 + order++ * 0.14;

  // --- Kicker pill (LIVE WEBINAR) with a pulsing dot ---
  let liveDot: Graphics | null = null;
  if (showKicker) {
    const dotR = kickerFont * 0.32;
    const textW = fonts.measure(kickerLabel, { family: fonts.family("body"), weight: 600, size: kickerFont, letterSpacing: 2 });
    const padX = kickerH * 0.5;
    const pillW = padX * 2 + dotR * 2 + kickerFont * 0.5 + textW + kickerFont * 0.4;
    const pill = new Container();
    pill.position.set(cx, centers.kicker!);
    pill.alpha = 0;
    root.addChild(pill);
    pill.addChild(makePill(pillW, kickerH, accent));
    const dot = new Graphics().circle(0, 0, dotR).fill(accentInk);
    dot.position.set(-pillW / 2 + padX + dotR, 0);
    pill.addChild(dot);
    liveDot = dot;
    const kText = makeText(fonts, { text: kickerLabel, role: "body", weight: 600, size: kickerFont, color: accentInk, anchor: { x: 0, y: 0.5 }, letterSpacing: 2 });
    kText.position.set(-pillW / 2 + padX + dotR * 2 + kickerFont * 0.5, 0);
    pill.addChild(kText);
    const st = nextStart();
    timeline
      .to(pill, { prop: "alpha", from: 0, to: 1, start: st, duration: 0.4, ease: outQuad })
      .to(pill, { prop: "y", from: centers.kicker! - 12, to: centers.kicker!, start: st, duration: 0.5, ease: outExpo });
  }

  // --- Title ---
  const titleText = makeText(fonts, {
    text: titleLines.join("\n"),
    role: "display",
    weight: 700,
    size: titleFont,
    color: textColor,
    anchor: 0.5,
    align: "center",
    lineHeight: titleLH,
  });
  titleText.position.set(cx, centers.title! + 14);
  titleText.alpha = 0;
  root.addChild(titleText);
  {
    const st = nextStart();
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: st, duration: 0.45, ease: outQuad })
      .to(titleText, { prop: "y", from: centers.title! + 14, to: centers.title!, start: st, duration: 0.6, ease: outExpo });
  }

  // --- Date/time pill ---
  {
    const dotR = dateFont * 0.28;
    const dateW = fitSize(fonts, date, "body", 600, dateFont, maxW - dateH * 2);
    const measured = fonts.measure(date, { family: fonts.family("body"), weight: 600, size: dateW });
    const padX = dateH * 0.62;
    const pillW = padX * 2 + dotR * 2 + dateFont * 0.5 + measured;
    const pill = new Container();
    pill.position.set(cx, centers.date!);
    pill.alpha = 0;
    root.addChild(pill);
    pill.addChild(makePill(pillW, dateH, cardBg));
    pill.addChild(new Graphics().roundRect(-pillW / 2, -dateH / 2, pillW, dateH, dateH / 2).stroke({ color: accent, width: Math.max(1.5, dateH * 0.03), alpha: 0.5 }));
    const dot = new Graphics().circle(-pillW / 2 + padX + dotR, 0, dotR).fill(accent);
    pill.addChild(dot);
    const dText = makeText(fonts, { text: date, role: "body", weight: 600, size: dateW, color: textColor, anchor: { x: 0, y: 0.5 } });
    dText.position.set(-pillW / 2 + padX + dotR * 2 + dateFont * 0.5, 0);
    pill.addChild(dText);
    const st = nextStart();
    timeline
      .to(pill, { prop: "alpha", from: 0, to: 1, start: st, duration: 0.4, ease: outQuad })
      .to(pill, { prop: "y", from: centers.date! - 10, to: centers.date!, start: st, duration: 0.5, ease: outQuint });
  }

  // --- Host avatars + names ---
  if (showHosts && hosts.length > 0) {
    const rowCy = centers.hosts!;
    const avCy = rowCy - hostsH / 2 + avR;
    const rowLeft = cx - hostsRowW / 2;
    const rowStart = nextStart();
    hosts.forEach((nm, i) => {
      const acx = rowLeft + i * (avR * 2 + hostGap) + avR;
      const initial = (nm.trim()[0] ?? "?").toUpperCase();
      const av = avatar(fonts, { radius: avR, bg: AVATAR_BG[i % AVATAR_BG.length]!, initial, textColor: "#FFFFFF", ring: { color: cardBg, width: Math.max(2, avR * 0.06) } });
      av.position.set(acx, avCy);
      av.scale.set(0);
      root.addChild(av);
      const nmFont = fitSize(fonts, nm, "body", 600, hostNameFont, hostCellW * 0.98);
      const nmText = makeText(fonts, { text: nm, role: "body", weight: 600, size: nmFont, color: textColor, anchor: 0.5 });
      nmText.position.set(acx, avCy + avR + minDim * 0.014 + hostNameFont / 2);
      nmText.alpha = 0;
      root.addChild(nmText);
      const st = rowStart + i * 0.09;
      timeline
        .to(av, { prop: "scale.x", from: 0, to: 1, start: st, duration: 0.55, ease: makeOutBack(1.9) })
        .to(av, { prop: "scale.y", from: 0, to: 1, start: st, duration: 0.55, ease: makeOutBack(1.9) })
        .to(nmText, { prop: "alpha", from: 0, to: 1, start: st + 0.12, duration: 0.4, ease: outQuad });
    });
  }

  // --- Register button (enters, then gently pulses) ---
  const btnLabelW = fonts.measure(cta, { family: fonts.family("display"), weight: 700, size: btnFont });
  const btnW = btnLabelW + btnH * 1.5;
  const btnWrap = new Container();
  btnWrap.position.set(cx, centers.button!);
  btnWrap.alpha = 0;
  root.addChild(btnWrap);
  const btnCore = new Container();
  btnWrap.addChild(btnCore);
  // Soft shadow so the CTA reads as a raised, tappable button.
  btnCore.addChild(new Graphics().roundRect(-btnW / 2, -btnH / 2 + btnH * 0.08, btnW, btnH, btnH / 2).fill({ color: "#000000", alpha: 0.14 }));
  btnCore.addChild(makePill(btnW, btnH, accent));
  const btnLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: btnFont, color: accentInk, anchor: 0.5 });
  btnCore.addChild(btnLabel);
  const btnStart = nextStart();
  timeline
    .to(btnWrap, { prop: "alpha", from: 0, to: 1, start: btnStart, duration: 0.4, ease: outQuad })
    .to(btnWrap, { prop: "y", from: centers.button! + 16, to: centers.button!, start: btnStart, duration: 0.6, ease: spring(0.5) });

  // Pure per-frame hooks: a gentle button pulse + a soft "live" dot blink.
  const pulseFrom = btnStart + 0.7;
  const update = (t: number): void => {
    const ramp = Math.max(0, Math.min(1, (t - pulseFrom) / 0.5));
    const s = 1 + 0.03 * ramp * Math.sin((t - pulseFrom) * Math.PI * 2 * 0.85);
    btnCore.scale.set(s);
    if (liveDot) liveDot.alpha = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.1));
  };

  return { timeline, duration: DURATION, update };
}

export const webinarInvite: TemplateDefinition = {
  id: "webinar-invite",
  name: "Webinar Invite",
  tagline: "A live-session invite — kicker, title, date pill, hosts, and a pulsing register button.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Scaling Design Systems", maxLength: 48, shrinkToFit: true },
    { key: "date", type: "text", label: "Date / time", default: "Thu Aug 14 · 5PM", maxLength: 28, shrinkToFit: true },
    {
      key: "hosts",
      type: "textlist",
      label: "Hosts",
      default: DEFAULT_HOSTS,
      minItems: 2,
      maxItems: 3,
      maxLength: 22,
      help: "One host name per line (2–3).",
    },
    { key: "cta", type: "text", label: "Button", default: "Register free", maxLength: 22, shrinkToFit: true },
    { key: "showKicker", type: "toggle", label: "Live badge", default: true },
    { key: "showHosts", type: "toggle", label: "Host avatars", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
