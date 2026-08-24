import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  spring,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { avatar } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Shrink a single-line size so `text` fits `maxWidth`. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

/** "Amara Chen" -> "AC"; a single word falls back to its first two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
}

// A conference/interview speaker-intro card slides in from the left — a
// circular avatar (or placeholder initials), a bold name, a role line, and a
// company/handle line, beside a thin accent spine. Only the full-frame `bg`
// rect is tied to the background field (defaults to the transparent sentinel
// so it composites straight onto footage); the card uses its own
// palette-only `cardBg` (and the placeholder avatar its own `avatarBack`) so
// both stay legible once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "newsroom-navy", name: "Newsroom navy", colors: { cardBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", avatarBack: "#26262C" } },
  { id: "paper-ink", name: "Paper ink", colors: { cardBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6", avatarBack: "#ECECEC" } },
  { id: "wire-blue", name: "Wire blue", colors: { cardBg: "#0B1F4D", textColor: "#FFFFFF", accent: "#33D9C4", avatarBack: "#173167" } },
  { id: "conference-cream", name: "Conference cream", colors: { cardBg: "#FAF6EC", textColor: "#241A0A", accent: "#B5651D", avatarBack: "#EFE6D2" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const cardBg = pc("cardBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const avatarBack = pc("avatarBack", "#26262C");
  const name = str(values.name, "Amara Chen");
  const role = str(values.role, "VP of Product");
  const company = str(values.company, "Nova Labs");
  const showAvatar = values.showAvatar !== false;
  const showSpine = values.showSpine !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const avatarR = Math.round(minDim * 0.05);
  const padX = Math.round(minDim * 0.028);
  const padY = Math.round(minDim * 0.024);
  const spineW = Math.max(3, Math.round(minDim * 0.009));
  const spineGap = Math.round(minDim * 0.022);
  const gapAvatarText = Math.round(minDim * 0.024);
  const rowGap = Math.round(minDim * 0.008);

  const spineBlockW = showSpine ? spineW + spineGap : 0;
  const avatarBlockW = showAvatar ? avatarR * 2 + gapAvatarText : 0;
  const maxTextW = Math.max(140, w * 0.46 - avatarBlockW - spineBlockW);

  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * 0.04), maxTextW);
  const roleSize = role.length > 0 ? fitSize(fonts, role, "body", 600, Math.round(minDim * 0.024), maxTextW) : 0;
  const companySize = company.length > 0 ? fitSize(fonts, company, "body", 500, Math.round(minDim * 0.02), maxTextW) : 0;

  const nameW = fonts.measure(name, { family: fonts.family("display"), weight: 700, size: nameSize });
  const roleW = role.length > 0 ? fonts.measure(role, { family: fonts.family("body"), weight: 600, size: roleSize }) : 0;
  const companyW = company.length > 0 ? fonts.measure(company, { family: fonts.family("body"), weight: 500, size: companySize }) : 0;
  const textBlockW = Math.max(nameW, roleW, companyW);

  let textRowsH = nameSize;
  if (role.length > 0) textRowsH += rowGap + roleSize;
  if (company.length > 0) textRowsH += rowGap + companySize;

  const contentH = Math.max(showAvatar ? avatarR * 2 : 0, textRowsH);
  const cardH = padY * 2 + contentH;
  const cardW = padX * 2 + spineBlockW + avatarBlockW + textBlockW;
  const cardRadius = Math.round(cardH * 0.16);

  const marginBottom = Math.round(minDim * 0.03);
  const restX = zone.left + cardW / 2;
  const restY = h - zone.bottom - marginBottom - cardH / 2;
  const slideDist = cardW + minDim * 0.1;
  const startX = restX - slideDist;

  const card = new Container();
  card.position.set(startX, restY);
  card.alpha = 0;
  root.addChild(card);

  // Soft shadow so the card reads as a distinct surface over any footage.
  const e = Math.round(cardH * 0.035);
  const off = Math.round(cardH * 0.06);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

  let cursorX = -cardW / 2 + padX;

  // --- Accent spine: a thin rounded bar just inside the card's left edge. ---
  if (showSpine) {
    const spineH = cardH - padY * 1.1;
    const spine = new Graphics().roundRect(-spineW / 2, -spineH / 2, spineW, spineH, spineW / 2).fill(accent);
    spine.position.set(cursorX + spineW / 2, 0);
    spine.scale.set(1, 0);
    spine.label = "spine";
    card.addChild(spine);
    timeline.to(spine, { prop: "scale.y", from: 0, to: 1, start: 0.42, duration: 0.4, ease: outExpo });
  }
  cursorX += spineBlockW;

  // --- Avatar (image or placeholder initials) ---
  if (showAvatar) {
    const avatarNode = new Container();
    avatarNode.position.set(cursorX + avatarR, 0);
    avatarNode.scale.set(0);
    card.addChild(avatarNode);

    const tex = images.avatar ?? null;
    const ringWidth = Math.max(2, avatarR * 0.08);
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      const cover = (2 * avatarR) / Math.min(tex.width, tex.height);
      s.scale.set(cover);
      const mask = new Graphics().circle(0, 0, avatarR).fill(0xffffff);
      avatarNode.addChild(s, mask);
      s.mask = mask;
      avatarNode.addChild(new Graphics().circle(0, 0, avatarR).stroke({ color: accent, width: ringWidth }));
    } else {
      avatarNode.addChild(
        avatar(fonts, {
          radius: avatarR,
          bg: avatarBack,
          initial: initialsOf(name),
          textColor,
          ring: { color: accent, width: ringWidth },
        }),
      );
    }

    timeline
      .to(avatarNode, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.5, ease: spring(0.45) })
      .to(avatarNode, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.5, ease: spring(0.45) });
  }
  cursorX += avatarBlockW;

  const textX = cursorX;
  const top = -textRowsH / 2;
  let rowY = top + nameSize / 2;
  const nameY = rowY;
  let roleY = 0;
  let companyY = 0;
  if (role.length > 0) {
    rowY += nameSize / 2 + rowGap + roleSize / 2;
    roleY = rowY;
  }
  if (company.length > 0) {
    rowY += (role.length > 0 ? roleSize / 2 : nameSize / 2) + rowGap + companySize / 2;
    companyY = rowY;
  }

  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(textX, nameY + 14);
  nameText.alpha = 0;
  card.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.46, duration: 0.35, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 14, to: nameY, start: 0.46, duration: 0.45, ease: outQuint });

  if (role.length > 0) {
    const roleText = makeText(fonts, { text: role, role: "body", weight: 600, size: roleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    roleText.alpha = 0;
    roleText.position.set(textX, roleY + 12);
    card.addChild(roleText);
    timeline
      .to(roleText, { prop: "alpha", from: 0, to: 0.9, start: 0.56, duration: 0.35, ease: outQuad })
      .to(roleText, { prop: "y", from: roleY + 12, to: roleY, start: 0.56, duration: 0.45, ease: outQuint });
  }

  if (company.length > 0) {
    const companyText = makeText(fonts, { text: company, role: "body", weight: 500, size: companySize, color: textColor, anchor: { x: 0, y: 0.5 } });
    companyText.alpha = 0;
    companyText.position.set(textX, companyY + 10);
    card.addChild(companyText);
    timeline
      .to(companyText, { prop: "alpha", from: 0, to: 0.68, start: 0.64, duration: 0.35, ease: outQuad })
      .to(companyText, { prop: "y", from: companyY + 10, to: companyY, start: 0.64, duration: 0.45, ease: outQuint });
  }

  // --- Card entrance: slides in from the left, then holds. ---
  timeline
    .to(card, { prop: "x", from: startX, to: restX, start: 0.0, duration: 0.55, ease: outExpo })
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.3, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const speakerCard: TemplateDefinition = {
  id: "speaker-card",
  name: "Speaker Card",
  tagline: "A conference speaker card slides in with an avatar, name, and role.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { name: "display", role: "body", company: "body" },
  palettes: PALETTES,
  fields: [
    { key: "avatar", type: "image", label: "Avatar image", default: "", optional: true, help: "A square headshot works best." },
    { key: "name", type: "text", label: "Name", default: "Amara Chen", maxLength: 30, shrinkToFit: true },
    { key: "role", type: "text", label: "Role", default: "VP of Product", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "company", type: "text", label: "Company / handle", default: "Nova Labs", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showAvatar", type: "toggle", label: "Avatar", default: true },
    { key: "showSpine", type: "toggle", label: "Accent spine", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
