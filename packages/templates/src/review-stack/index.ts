import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  inOutQuad,
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
import { makeIcon } from "../shared/icons";
import { avatar } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** A multi-line, word-wrapped centered text bound to a font role. */
function wrapText(
  fonts: FontRegistry,
  o: { text: string; role: FontRole; weight: number; size: number; color: string; width: number; lineHeight: number },
): Text {
  const t = makeText(fonts, { text: o.text, role: o.role, weight: o.weight, size: o.size, color: o.color, align: "center", anchor: 0.5, lineHeight: o.lineHeight });
  t.style.wordWrap = true;
  t.style.wordWrapWidth = o.width;
  return t;
}

interface Review {
  name: string;
  stars: number;
  quote: string;
}

function parseReview(raw: string): Review {
  const parts = raw.split("|");
  const name = (parts[0] ?? "").trim();
  const starsRaw = (parts[1] ?? "").trim();
  const quote = parts.slice(2).join("|").trim();
  const stars = Math.max(1, Math.min(5, Math.round(Number(starsRaw) || 5)));
  return { name: name || "Reviewer", stars, quote: quote || "Genuinely delightful to use every day." };
}

const DEFAULT_REVIEWS = [
  "Maya Lopez|5|Cut our editing time in half — everything just clicks.",
  "Devin Park|5|The templates look pro without any design skills.",
  "Sara Kim|4|Fast, free, and the exports are crisp. Love it.",
];

// A stack of review cards flips through one at a time. The card surface uses its
// own `cardBg` so it survives transparent export; the peeking stack behind adds
// depth. Text stays in `textColor` (≥4.5:1 on cardBg).
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F7", textColor: "#0F1420", accent: "#3B4FD6", onAccent: "#FFFFFF", cardBg: "#FFFFFF", muted: "#C7CEDB", roleColor: "#5B6472" } },
  { id: "cream", name: "Cream", colors: { background: "#F6EEE2", textColor: "#241A12", accent: "#C2410C", onAccent: "#FFFFFF", cardBg: "#FFFFFF", muted: "#E4D9C8", roleColor: "#7A6144" } },
  { id: "mint", name: "Mint", colors: { background: "#E4F3EB", textColor: "#0B241A", accent: "#0A6B3A", onAccent: "#FFFFFF", cardBg: "#FFFFFF", muted: "#C4D9CD", roleColor: "#4C6B5C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#6EA8FE", onAccent: "#0C1018", cardBg: "#161C28", muted: "#38414F", roleColor: "#A7B0BF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F7"));
  const textColor = str(values.textColor, pc("textColor", "#0F1420"));
  const accent = str(values.accent, pc("accent", "#3B4FD6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const onAccent = pc("onAccent", "#FFFFFF");
  const muted = pc("muted", "#C7CEDB");
  const roleColor = pc("roleColor", "#5B6472");

  const reviews = asList(values.reviews, DEFAULT_REVIEWS).slice(0, 3).map(parseReview);
  const n = Math.max(1, reviews.length);
  const showStack = values.showStack !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height * 0.5;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const cardW = Math.min(zone.width * 0.84, minDim * 0.66);
  const cardH = Math.min(zone.height * 0.74, minDim * 0.7);
  const cardR = Math.round(minDim * 0.035);

  // Peeking stack behind the front card (decorative depth).
  if (showStack) {
    for (let i = 2; i >= 1; i--) {
      const s = 1 - i * 0.05;
      const dy = i * minDim * 0.022;
      const back = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg);
      back.position.set(cx, cy + dy);
      back.scale.set(s, s);
      back.alpha = 0;
      root.addChild(back);
      back.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).stroke({ color: muted, width: 2, alpha: 0.5 }));
      timeline.to(back, { prop: "alpha", from: 0, to: 0.85, start: 0.2 + (2 - i) * 0.08, duration: 0.4, ease: outQuad });
    }
  }

  // Front card (flips).
  const card = new Container();
  card.position.set(cx, cy);
  card.scale.set(0);
  root.addChild(card);
  const e = Math.round(minDim * 0.006);
  const off = Math.round(minDim * 0.012);
  card.addChild(new Graphics().roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardR + e).fill({ color: "#000000", alpha: 0.12 }));
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));

  const rA = cardW * 0.1;
  const nameSize = Math.round(cardW * 0.058);
  const starSize = Math.round(cardW * 0.06);
  const starGap = starSize * 1.26;
  const quoteSize = Math.round(cardW * 0.056);

  // Build a content container per review; only one visible at a time.
  const contents: Container[] = reviews.map((rv, ri) => {
    const cont = new Container();
    cont.visible = ri === 0;
    card.addChild(cont);

    const initial = (rv.name.trim().charAt(0) || "?").toUpperCase();
    const av = avatar(fonts, { radius: rA, bg: accent, initial, textColor: onAccent });
    av.position.set(0, -cardH * 0.32);
    cont.addChild(av);

    const nameText = makeText(fonts, { text: rv.name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5 });
    nameText.position.set(0, -cardH * 0.32 + rA + nameSize * 0.9);
    cont.addChild(nameText);

    const starsY = -cardH * 0.06;
    const starX0 = -starGap * 2;
    for (let i = 0; i < 5; i++) {
      const st = makeIcon("star", starSize, { color: i < rv.stars ? accent : muted });
      st.position.set(starX0 + i * starGap, starsY);
      cont.addChild(st);
    }

    const quote = wrapText(fonts, { text: `“${rv.quote}”`, role: "serif", weight: 600, size: quoteSize, color: roleColor, width: cardW * 0.82, lineHeight: Math.round(quoteSize * 1.34) });
    quote.position.set(0, cardH * 0.2);
    cont.addChild(quote);

    return cont;
  });

  // Entry pop (reveals review 0).
  timeline
    .to(card, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.55, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.55, ease: makeOutBack(1.5) });

  // Flip transitions between consecutive reviews.
  for (let k = 0; k < n - 1; k++) {
    const seam = 1.75 + k * 1.4;
    timeline
      .to(card, { prop: "scale.x", from: 1, to: 0.02, start: seam - 0.2, duration: 0.2, ease: inOutQuad })
      .to(card, { prop: "scale.x", from: 0.02, to: 1, start: seam, duration: 0.24, ease: outExpo });
    const cur = contents[k];
    const nxt = contents[k + 1];
    if (cur) timeline.set(cur, "visible", false, seam);
    if (nxt) timeline.set(nxt, "visible", true, seam);
  }

  return { timeline, duration: 5.0 };
}

export const reviewStack: TemplateDefinition = {
  id: "review-stack",
  name: "Review Stack",
  tagline: "A stack of review cards flips through one at a time.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 4.2,
  fontRoles: { name: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "reviews",
      type: "textlist",
      label: "Reviews",
      default: DEFAULT_REVIEWS,
      minItems: 1,
      maxItems: 3,
      maxLength: 80,
      help: 'One per line as "name|stars|quote", e.g. "Maya Lopez|5|Love it.".',
    },
    { key: "showStack", type: "toggle", label: "Stacked cards", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
