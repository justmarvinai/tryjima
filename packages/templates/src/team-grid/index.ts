import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeZone,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { avatar } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

const DEFAULT_MEMBERS = ["Sam | Founder", "Alex | Design", "Mia | Growth", "Jo | Support"];
const AVATAR_COLORS = ["#FF4D1C", "#7C5CFF", "#2E7DF6", "#17A34A", "#FF2E9E", "#F59E0B"];

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#5B5B68", card: "#F5F6F8", onAccent: "#FFFFFF" } },
  { id: "porcelain", name: "Porcelain", colors: { background: "#F1F4F9", textColor: "#16233A", accent: "#2E5BD6", muted: "#526078", card: "#FFFFFF", onAccent: "#FFFFFF" } },
  { id: "lime", name: "Lime", colors: { background: "#F3FAE3", textColor: "#16230A", accent: "#5F9E12", muted: "#5E6B4E", card: "#FFFFFF", onAccent: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF6A3C", muted: "#A7ADB8", card: "#1E1D24", onAccent: "#101014" } },
];

interface Member {
  name: string;
  role: string;
}

function parseMember(raw: string): Member {
  const idx = raw.indexOf("|");
  if (idx >= 0) {
    const name = raw.slice(0, idx).trim();
    const role = raw.slice(idx + 1).trim();
    return { name: name.length > 0 ? name : raw.trim(), role };
  }
  return { name: raw.trim(), role: "" };
}

function memberList(values: Values): Member[] {
  return asList(values.members, DEFAULT_MEMBERS).slice(0, 6).map(parseMember);
}

function computeDuration(values: Values): number {
  return 1.0 + memberList(values).length * 0.25 + 1.4;
}

function colsFor(aspect: Aspect, n: number): number {
  if (aspect === "16:9") return n <= 4 ? n : n <= 6 ? 3 : 4;
  if (aspect === "9:16") return n <= 2 ? n : 2;
  return n <= 3 ? n : n === 4 ? 2 : 3;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function memberCard(
  fonts: TemplateContext["fonts"],
  tex: Texture | null,
  m: Member,
  cardW: number,
  cardH: number,
  rA: number,
  accent: string,
  textColor: string,
  muted: string,
  cardC: string,
  onAccent: string,
  rng: TemplateContext["rng"],
): Container {
  const card = new Container();
  const r = Math.min(cardW, cardH) * 0.1;
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.04, cardW, cardH, r).fill({ color: 0x000000, alpha: 0.06 }));
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(cardC).stroke({ color: textColor, width: 1, alpha: 0.08 }));

  const avatarCy = -cardH / 2 + rA + cardH * 0.07;
  if (tex) {
    const holder = new Container();
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = (2 * rA) / Math.min(tex.width, tex.height);
    s.scale.set(cover);
    const mk = new Graphics().circle(0, 0, rA).fill(0xffffff);
    holder.addChild(s, mk);
    s.mask = mk;
    holder.addChild(new Graphics().circle(0, 0, rA).stroke({ color: accent, width: Math.max(2, rA * 0.08) }));
    holder.position.set(0, avatarCy);
    card.addChild(holder);
  } else {
    const av = avatar(fonts, { radius: rA, bg: rng.pick(AVATAR_COLORS), initial: (m.name.trim().charAt(0) || "?").toUpperCase(), textColor: onAccent });
    av.position.set(0, avatarCy);
    card.addChild(av);
  }

  const nameSize = Math.round(Math.min(cardW, cardH) * 0.13);
  const nameY = avatarCy + rA + nameSize * 0.95;
  const nameTxt = fitText(
    fonts,
    { text: m.name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" },
    cardW * 0.92,
  );
  nameTxt.position.set(0, nameY);
  card.addChild(nameTxt);

  if (m.role.length > 0) {
    const roleSize = Math.round(nameSize * 0.66);
    const roleY = nameY + nameSize * 0.72;
    const roleTxt = fitText(
      fonts,
      { text: m.role, role: "body", weight: 500, size: roleSize, color: muted, anchor: 0.5, align: "center" },
      cardW * 0.92,
    );
    roleTxt.position.set(0, roleY);
    card.addChild(roleTxt);
  }

  return card;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const muted = pc("muted", "#5B5B68");
  const cardC = pc("card", "#F5F6F8");
  const onAccent = pc("onAccent", "#FFFFFF");
  const title = str(values.title, "Meet the team");
  const members = memberList(values);
  const n = members.length;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const zone = safeZone(ctx.aspect);
  const timeline = new JimaTimeline();

  const photos: (Texture | null)[] = [
    images.photo1 ?? null,
    images.photo2 ?? null,
    images.photo3 ?? null,
    images.photo4 ?? null,
  ];

  const cols = colsFor(ctx.aspect, n);
  const rows = Math.ceil(n / cols);
  const titleSize = Math.round(w * (ctx.aspect === "16:9" ? 0.045 : 0.055));
  const titleY = zone.top + titleSize * 0.8;
  const gridTop = titleY + titleSize * 1.1;
  const gridBottom = h - zone.bottom;
  const gridH = gridBottom - gridTop;
  const contentW = w - zone.left - zone.right;
  const cellW = contentW / cols;
  const rowH = gridH / rows;

  members.forEach((m, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, n - row * cols);
    const startX = w / 2 - (inRow * cellW) / 2 + cellW / 2;
    const cx = startX + col * cellW;
    const cy = gridTop + (row + 0.5) * rowH;
    const cardW = cellW * 0.9;
    const cardH = rowH * 0.9;
    const rA = Math.min(cardW * 0.32, cardH * 0.26);
    const card = memberCard(fonts, photos[i] ?? null, m, cardW, cardH, rA, accent, textColor, muted, cardC, onAccent, rng);
    const rise = rowH * 0.06;
    card.position.set(cx, cy + rise);
    card.alpha = 0;
    card.scale.set(0);
    root.addChild(card);
    const start = 1.0 + i * 0.25;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(card, { prop: "y", from: cy + rise, to: cy, start, duration: 0.66, ease: spring(0.5) })
      .to(card, { prop: "scale.x", from: 0, to: 1, start, duration: 0.66, ease: spring(0.5) })
      .to(card, { prop: "scale.y", from: 0, to: 1, start, duration: 0.66, ease: spring(0.5) });
  });

  // Section title on top.
  const titleTxt = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
    contentW * 0.9,
  );
  titleTxt.position.set(w / 2, titleY);
  titleTxt.alpha = 0;
  root.addChild(titleTxt);
  timeline
    .to(titleTxt, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(titleTxt, { prop: "y", from: titleY - 18, to: titleY, start: 0.1, duration: 0.6, ease: outExpo });

  return { timeline, duration: computeDuration(values) };
}

export const teamGrid: TemplateDefinition = {
  id: "team-grid",
  name: "Team Grid",
  tagline: "Meet-the-team cards pop in under a headline.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Meet the team", maxLength: 32, shrinkToFit: true },
    { key: "members", type: "textlist", label: "Members", default: DEFAULT_MEMBERS, minItems: 2, maxItems: 6, maxLength: 28, help: "One per line as \"Name | Role\"." },
    { key: "photo1", type: "image", label: "Photo 1", default: "", optional: true },
    { key: "photo2", type: "image", label: "Photo 2", default: "", optional: true },
    { key: "photo3", type: "image", label: "Photo 3", default: "", optional: true },
    { key: "photo4", type: "image", label: "Photo 4", default: "", optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
