import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A cascade of notification pills. Only the full-frame `bg` rect is tied to the
// background field; each card uses its own palette-only `cardBg` so it survives
// as overlay content. Icon-circle glyphs use `onAccent`.
const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#101014", accent: "#FF3B5C", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0C10", cardBg: "#1B1E27", textColor: "#FFFFFF", accent: "#FF6A3D", onAccent: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF3FF", cardBg: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6", onAccent: "#FFFFFF" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#150F24", cardBg: "#221833", textColor: "#FFFFFF", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
];

interface Notif {
  name: string;
  action: string;
  time: string;
}
const DEFAULT_NOTIFS = [
  "Ava Chen|liked your post|2m",
  "Marco|started following you|5m",
  "Priya|commented: so good!|12m",
  "Dev Studio|mentioned you|1h",
];

function parseNotif(raw: string): Notif {
  const p = raw.split("|").map((s) => s.trim());
  return {
    name: p[0] && p[0].length > 0 ? p[0] : "Someone",
    action: p[1] && p[1].length > 0 ? p[1] : "sent a notification",
    time: p[2] && p[2].length > 0 ? p[2] : "now",
  };
}

/** Pick a glyph from the action wording, falling back to a stable cycle. */
function glyphFor(action: string, i: number): IconName {
  const a = action.toLowerCase();
  if (/lik|love|heart|react/.test(a)) return "heart";
  if (/comment|repl|said|:/.test(a)) return "comment";
  if (/follow|subscrib|join/.test(a)) return "user";
  if (/mention|star|save|favorit|tag|shout/.test(a)) return "star";
  return (["heart", "comment", "user", "star"] as const)[i % 4]!;
}

function notifsOf(values: Values): Notif[] {
  return asList(values.notifications, DEFAULT_NOTIFS).slice(0, 5).map(parseNotif);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF3B5C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const showIcons = values.showIcons !== false;

  const notifs = notifsOf(values);
  const n = notifs.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Card geometry ---
  const cardW = Math.min(safe.width, minDim * 1.12);
  const cardH = Math.round(minDim * 0.125);
  const cardRadius = Math.round(cardH * 0.28);
  const gap = Math.round(minDim * 0.03);
  const padL = Math.round(cardH * 0.2);

  const total = n * cardH + (n - 1) * gap;
  const top = safe.y + Math.max(0, (safe.height - total) / 2);

  const iconR = cardH * 0.3;
  const iconGap = cardH * 0.18;
  const textLeft = showIcons ? -cardW / 2 + padL + iconR * 2 + iconGap : -cardW / 2 + padL;

  const timeFont = Math.round(cardH * 0.15);
  const nameFontBase = Math.round(cardH * 0.24);

  const familyDisplay = fonts.family("display");
  const familyBody = fonts.family("body");

  const START = 0.1;
  const STAGGER = 0.13;

  notifs.forEach((notif, i) => {
    const cardCy = top + i * (cardH + gap) + cardH / 2;

    const card = new Container();
    card.position.set(cx, cardCy);
    card.alpha = 0;
    card.scale.set(0.96);
    root.addChild(card);

    // shadow + surface
    const e = Math.round(cardH * 0.045);
    card.addChild(
      new Graphics()
        .roundRect(-cardW / 2 - e, -cardH / 2 - e + e * 1.4, cardW + e * 2, cardH + e * 2, cardRadius + e)
        .fill({ color: "#000000", alpha: 0.12 }),
    );
    card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

    // icon circle
    if (showIcons) {
      const iconCx = -cardW / 2 + padL + iconR;
      card.addChild(new Graphics().circle(iconCx, 0, iconR).fill(accent));
      const glyph = makeIcon(glyphFor(notif.action, i), iconR * 1.15, { color: onAccent, holeColor: accent });
      glyph.position.set(iconCx, 0);
      card.addChild(glyph);
    }

    // time (right, muted)
    const timeStr = notif.time;
    const timeW = fonts.measure(timeStr, { family: familyBody, weight: 600, size: timeFont });
    const timeRight = cardW / 2 - padL;
    const timeText = makeText(fonts, { text: timeStr, role: "body", weight: 600, size: timeFont, color: textColor, anchor: { x: 1, y: 0.5 } });
    timeText.position.set(timeRight, 0);
    timeText.alpha = 0.55;
    card.addChild(timeText);

    // name + action on one line — sized so the whole line fits before the time
    const textMaxW = timeRight - timeW - cardH * 0.22 - textLeft;
    const nameGap = " ";
    const combined = notif.name + nameGap + notif.action;
    const nameFont = fitSize(fonts, combined, "display", 700, nameFontBase, Math.max(40, textMaxW));
    const nameW = fonts.measure(notif.name + nameGap, { family: familyDisplay, weight: 700, size: nameFont });

    const nameText = makeText(fonts, { text: notif.name, role: "display", weight: 700, size: nameFont, color: textColor, anchor: { x: 0, y: 0.5 } });
    nameText.position.set(textLeft, 0);
    card.addChild(nameText);

    const actionText = makeText(fonts, { text: notif.action, role: "body", weight: 500, size: nameFont, color: textColor, anchor: { x: 0, y: 0.5 } });
    actionText.alpha = 0.82;
    actionText.position.set(textLeft + nameW, 0);
    card.addChild(actionText);

    // cascade in from above its slot, settling into the neat stack
    const start = START + i * STAGGER;
    const fromY = cardCy - minDim * 0.09;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(card, { prop: "y", from: fromY, to: cardCy, start, duration: 0.6, ease: outExpo })
      .to(card, { prop: "scale.x", from: 0.96, to: 1, start, duration: 0.55, ease: makeOutBack(1.5) })
      .to(card, { prop: "scale.y", from: 0.96, to: 1, start, duration: 0.55, ease: makeOutBack(1.5) });
  });

  return { timeline, duration: 3.2 };
}

export const notifStack: TemplateDefinition = {
  id: "notif-stack",
  name: "Notification Stack",
  tagline: "Notification pills cascade in from the top and settle into a stack.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { notifications: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "notifications",
      type: "textlist",
      label: "Notifications",
      default: DEFAULT_NOTIFS,
      minItems: 3,
      maxItems: 5,
      maxLength: 40,
      help: 'One per line as "Name|action|time", e.g. "Ava|liked your post|2m".',
    },
    { key: "showIcons", type: "toggle", label: "Show icons", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
