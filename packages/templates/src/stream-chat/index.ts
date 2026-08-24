import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  spring,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { verticalScrimTexture } from "../shared/scrim";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const DEFAULT_MESSAGES = [
  "@sam_k | this stream is amazing!!",
  "@lunar.vibes | no way \u{1F525}\u{1F525}",
  "@dev_maria | let's goooo",
  "@pixelpete | W stream fr",
];
const AVATAR_COLORS = ["#FF4D1C", "#7C5CFF", "#2E7DF6", "#F59E0B", "#FF2E9E", "#0EA5C4"];

const START0 = 0.3;
const PER = 0.42;
const ROW_SETTLE = 0.6;
const HOLD = 1.3;

const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", textColor: "#FFFFFF", accent: "#FFB020" } },
  { id: "cobalt-night", name: "Cobalt night", colors: { background: "#0A1220", textColor: "#FFFFFF", accent: "#2E7DF6" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#150A24", textColor: "#FFFFFF", accent: "#B084F5" } },
  { id: "forest-night", name: "Forest night", colors: { background: "#08140F", textColor: "#FFFFFF", accent: "#33E2A0" } },
];

interface ParsedMsg {
  user: string;
  text: string;
}

/** Parse "@user | message" — forgiving of missing separators. */
function parseMsg(raw: string): ParsedMsg {
  const parts = raw.split("|");
  if (parts.length >= 2) {
    const userRaw = (parts[0] ?? "").trim();
    const user = userRaw.length > 0 ? (userRaw.startsWith("@") ? userRaw : `@${userRaw}`) : "@user";
    const text = (parts[1] ?? "").trim();
    return { user, text: text.length > 0 ? text : raw.trim() };
  }
  return { user: "@user", text: raw.trim() };
}

function messagesOf(values: Values): string[] {
  return asItems(values.messages, DEFAULT_MESSAGES).slice(0, 5);
}

function computeDuration(values: Values): number {
  const n = messagesOf(values).length + (on(values.showDonation) ? 1 : 0);
  return START0 + Math.max(0, n - 1) * PER + ROW_SETTLE + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0B0B10"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FFB020"));
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const showDonation = on(values.showDonation);
  const showScrim = on(values.showScrim);

  const donationUser = str(values.donationUser, "@bigfan_22");
  const donationText = str(values.donationText, "Keep it up, love this! \u{1F389}");
  const donationAmount = str(values.donationAmount, "$5.00");

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const k = minDim / 1080;
  const safe = safeRect(ctx.aspect);

  const rowH = 64 * k;
  const donationH = 96 * k;
  const avatarR = rowH * 0.32;
  const padX = 24 * k;
  const gapAvatarText = 14 * k;
  const rowGap = 14 * k;
  const textSize0 = Math.round(rowH * 0.42);
  const donationTextSize0 = Math.round(donationH * 0.3);

  const familyDisplay = fonts.family("display");
  const familyBody = fonts.family("body");
  const measureBold = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });

  const parsedMessages = messagesOf(values).map(parseMsg);
  const normalMaxW = Math.min(safe.width * 0.76, minDim * 0.8);

  interface RowInfo {
    kind: "normal";
    user: string;
    text: string;
    size: number;
    w: number;
    h: number;
    color: string;
  }
  interface DonationRowInfo {
    kind: "donation";
    h: number;
  }

  const rows: (RowInfo | DonationRowInfo)[] = parsedMessages.map(({ user, text }) => {
    const combined = `${user} ${text}`;
    const size = shrinkToFit(combined, measureBold, {
      maxWidth: normalMaxW - padX * 2 - avatarR * 2 - gapAvatarText,
      baseSize: textSize0,
      minSize: Math.round(textSize0 * 0.62),
    });
    const userW = measureBold(user, size);
    const textW = fonts.measure(text, { family: familyBody, weight: 500, size });
    const contentW = avatarR * 2 + gapAvatarText + userW + (text.length > 0 ? size * 0.32 + textW : 0);
    const rowW = Math.min(normalMaxW, contentW + padX * 2);
    return { kind: "normal", user, text, size, w: rowW, h: rowH, color: rng.pick(AVATAR_COLORS) };
  });
  if (showDonation) rows.push({ kind: "donation", h: donationH });

  const n = rows.length;
  const totalH = rows.reduce((acc, r) => acc + r.h, 0) + rowGap * Math.max(0, n - 1);
  const stackBottom = safe.y + safe.height;
  const stackTop = Math.max(safe.y, stackBottom - totalH);

  // --- Bottom scrim: a soft dark gradient behind the whole feed for legibility ---
  if (showScrim) {
    const scrimH = Math.min(h, h - stackTop + minDim * 0.08);
    const scrim = new Sprite(verticalScrimTexture());
    scrim.tint = "#000000";
    scrim.width = w;
    scrim.height = scrimH;
    scrim.position.set(0, h - scrimH);
    scrim.alpha = 0;
    root.addChild(scrim);
    timeline.to(scrim, { prop: "alpha", from: 0, to: 0.55, start: 0, duration: 0.4, ease: outQuad });
  }

  const tops: number[] = [];
  let cursorY = stackTop;
  for (const r of rows) {
    tops.push(cursorY);
    cursorY += r.h + rowGap;
  }

  const riseAmt = 46 * k;

  rows.forEach((r, i) => {
    const restTop = tops[i]!;
    const start = START0 + i * PER;

    if (r.kind === "normal") {
      // Local coordinate space is centered on the row's own box (so pop-scale
      // reads naturally); pivot sits at the box center, position at its rest
      // center point restTop + h/2.
      const cy = restTop + r.h / 2;
      const c = new Container();
      c.addChild(new Graphics().roundRect(-r.w / 2, -r.h / 2, r.w, r.h, r.h * 0.42).fill({ color: "#FFFFFF", alpha: 0.09 }));

      const av = new Container();
      av.addChild(new Graphics().circle(0, 0, avatarR).fill(r.color));
      av.position.set(-r.w / 2 + padX + avatarR, 0);
      av.scale.set(0);
      c.addChild(av);

      const textLeft = -r.w / 2 + padX + avatarR * 2 + gapAvatarText;
      const uname = makeText(fonts, { text: r.user, role: "display", weight: 700, size: r.size, color: r.color, anchor: { x: 0, y: 0.5 } });
      uname.position.set(textLeft, 0);
      c.addChild(uname);
      if (r.text.length > 0) {
        const msg = makeText(fonts, { text: r.text, role: "body", weight: 500, size: r.size, color: textColor, anchor: { x: 0, y: 0.5 } });
        msg.position.set(textLeft + uname.width + r.size * 0.32, 0);
        c.addChild(msg);
      }

      c.position.set(safe.x + r.w / 2, cy + riseAmt);
      c.alpha = 0;
      c.scale.set(0.92);
      root.addChild(c);

      timeline
        .to(c, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
        .to(c, { prop: "y", from: cy + riseAmt, to: cy, start, duration: 0.6, ease: spring(0.5) })
        .to(c, { prop: "scale.x", from: 0.92, to: 1, start, duration: 0.55, ease: outExpo })
        .to(c, { prop: "scale.y", from: 0.92, to: 1, start, duration: 0.55, ease: outExpo })
        .to(av, { prop: "scale.x", from: 0, to: 1, start: start + 0.05, duration: 0.4, ease: makeOutBack(2) })
        .to(av, { prop: "scale.y", from: 0, to: 1, start: start + 0.05, duration: 0.4, ease: makeOutBack(2) });
    } else {
      const cy = restTop + r.h / 2;
      const barW = safe.width;
      const c = new Container();
      c.addChild(new Graphics().roundRect(-barW / 2, -r.h / 2, barW, r.h, r.h * 0.3).fill(accent));

      const iconSize = r.h * 0.4;
      const icon = makeIcon("heart", iconSize, { color: onAccent });
      icon.position.set(-barW / 2 + r.h * 0.32, 0);
      c.addChild(icon);

      const amountSize = Math.round(donationTextSize0 * 1.15);
      const amountText = makeText(fonts, { text: donationAmount, role: "display", weight: 800, size: amountSize, color: onAccent, anchor: { x: 1, y: 0.5 } });
      amountText.position.set(barW / 2 - r.h * 0.32, 0);
      c.addChild(amountText);

      const textLeft = -barW / 2 + r.h * 0.32 + iconSize * 0.75;
      const textRight = barW / 2 - r.h * 0.32 - amountText.width - r.h * 0.22;
      const availW = Math.max(10, textRight - textLeft);
      const combined = `${donationUser} ${donationText}`;
      const measureAt = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
      const dSize = shrinkToFit(combined, measureAt, { maxWidth: availW, baseSize: donationTextSize0, minSize: Math.round(donationTextSize0 * 0.6) });
      const userText = makeText(fonts, { text: donationUser, role: "display", weight: 700, size: dSize, color: onAccent, anchor: { x: 0, y: 0.5 } });
      userText.position.set(textLeft, -r.h * 0.14);
      c.addChild(userText);
      const msgText = makeText(fonts, { text: donationText, role: "body", weight: 500, size: Math.round(dSize * 0.92), color: onAccent, anchor: { x: 0, y: 0.5 } });
      msgText.alpha = 0.92;
      msgText.position.set(textLeft, r.h * 0.2);
      c.addChild(msgText);

      c.position.set(safe.x + barW / 2, cy + riseAmt);
      c.alpha = 0;
      c.scale.set(0.82);
      root.addChild(c);

      timeline
        .to(c, { prop: "alpha", from: 0, to: 1, start, duration: 0.32, ease: outQuad })
        .to(c, { prop: "y", from: cy + riseAmt, to: cy, start, duration: 0.62, ease: spring(0.48) })
        .to(c, { prop: "scale.x", from: 0.82, to: 1, start, duration: 0.6, ease: makeOutBack(1.8) })
        .to(c, { prop: "scale.y", from: 0.82, to: 1, start, duration: 0.6, ease: makeOutBack(1.8) });

      const settleAt = start + 0.6;
      timeline
        .to(c, { prop: "scale.x", from: 1, to: 1.03, start: settleAt, duration: 0.16, ease: outQuad })
        .to(c, { prop: "scale.y", from: 1, to: 1.03, start: settleAt, duration: 0.16, ease: outQuad })
        .to(c, { prop: "scale.x", from: 1.03, to: 1, start: settleAt + 0.16, duration: 0.28, ease: outExpo })
        .to(c, { prop: "scale.y", from: 1.03, to: 1, start: settleAt + 0.16, duration: 0.28, ease: outExpo });
    }
  });

  return { timeline, duration: computeDuration(values) };
}

export const streamChat: TemplateDefinition = {
  id: "stream-chat",
  name: "Stream Chat",
  tagline: "A livestream chat feed slides in, capped by a glowing superchat.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.7,
  estimateDuration: computeDuration,
  fontRoles: { donationUser: "display", donationText: "body", donationAmount: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "messages",
      type: "textlist",
      label: "Chat messages (@user | text)",
      default: DEFAULT_MESSAGES,
      minItems: 3,
      maxItems: 5,
      maxLength: 50,
      help: 'One per line as "@user | message".',
    },
    { key: "donationUser", type: "text", label: "Donor", default: "@bigfan_22", maxLength: 20 },
    { key: "donationText", type: "text", label: "Donation message", default: "Keep it up, love this! \u{1F389}", maxLength: 60 },
    { key: "donationAmount", type: "text", label: "Amount", default: "$5.00", maxLength: 10 },
    { key: "showDonation", type: "toggle", label: "Superchat row", default: true },
    { key: "showScrim", type: "toggle", label: "Bottom scrim", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Superchat color", default: "", optional: true },
  ],
  build,
};
