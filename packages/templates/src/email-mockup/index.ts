import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutQuint,
  outBack,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { avatar } from "../shared/ui";

// Email Preview — an inbox with three rows, one of them yours, which then
// *opens*: the row expands into the newsletter, subject and first paragraph
// and all. The signup post for anyone running a list.
//
// The open is the point. A static inbox screenshot is a nothing; the row
// growing into the letter is what makes a viewer imagine receiving it.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "inbox", name: "Inbox", colors: { background: "#EDEEF1", textColor: "#14161B", accent: "#2563EB" } },
  { id: "ink", name: "Ink", colors: { background: "#101216", textColor: "#F3F4F7", accent: "#60A5FA" } },
  { id: "warm", name: "Warm", colors: { background: "#F7F1E8", textColor: "#1D1810", accent: "#B45309" } },
  { id: "mint", name: "Mint", colors: { background: "#ECF4EF", textColor: "#0F1E17", accent: "#0F9D6E" } },
];

interface Layout {
  cardFrac: number;
  bodyFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.46, bodyFrac: 0.022, centerFrac: 0.5 };
    case "9:16":
      return { cardFrac: 0.88, bodyFrac: 0.032, centerFrac: 0.48 };
    case "4:5":
      return { cardFrac: 0.86, bodyFrac: 0.03, centerFrac: 0.49 };
    case "1:1":
    default:
      return { cardFrac: 0.84, bodyFrac: 0.029, centerFrac: 0.49 };
  }
}

const IN_AT = 0.3;
const OPEN_AT = 1.35;
const DURATION = 5.4;

const NOISE = ["Your receipt", "Weekly digest", "Re: next week"];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EDEEF1"));
  const textColor = str(values.textColor, pc("textColor", "#14161B"));
  const accent = str(values.accent, pc("accent", "#2563EB"));
  const sender = str(values.sender, "Fika Studio");
  const subject = str(values.subject, "Five things we learned shooting in the rain");
  const preview = str(values.preview, "Plus: the lens we stopped using, and why the client kept the outtakes.");
  const cta = str(values.cta, "").trim();
  const showInbox = on(values.showInbox);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const cardW = size.width * L.cardFrac;
  const bodySize = Math.round(size.width * L.bodyFrac);
  const rowH = bodySize * 4.2;
  const pad = bodySize * 1.1;

  const timeline = new JimaTimeline();
  const stack = new Container();
  stack.position.set(cx, cy);
  root.addChild(stack);

  // --- Two quiet rows above and one below, so the inbox reads as an inbox ---
  const makeRow = (label: string, y: number, dim: boolean): Container => {
    const row = new Container();
    row.position.set(0, y);
    row.addChild(
      new Graphics()
        .roundRect(-cardW / 2, -rowH / 2, cardW, rowH, bodySize * 0.55)
        .fill({ color: textColor, alpha: dim ? 0.045 : 0.06 }),
    );
    const av = avatar(fonts, {
      radius: bodySize * 1.05,
      bg: dim ? `${textColor}` : accent,
      initial: label.slice(0, 1).toUpperCase(),
      textColor: bg,
    });
    av.alpha = dim ? 0.35 : 1;
    av.position.set(-cardW / 2 + pad + bodySize, 0);
    row.addChild(av);
    const t = makeText(fonts, {
      text: label,
      role: "body",
      weight: 700,
      size: bodySize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.alpha = dim ? 0.35 : 1;
    t.position.set(-cardW / 2 + pad + bodySize * 2.6, 0);
    row.addChild(t);
    return row;
  };

  if (showInbox) {
    [-1, 1].forEach((s, i) => {
      const r = makeRow(NOISE[i] ?? "Update", s * rowH * 1.25, true);
      stack.addChild(r);
      r.alpha = 0;
      timeline
        .to(r, { prop: "alpha", from: 0, to: 1, start: IN_AT + 0.1 + i * 0.08, duration: 0.35, ease: outQuad })
        // They slide apart as the letter opens between them.
        .to(r, { prop: "y", from: s * rowH * 1.25, to: s * rowH * 3.6, start: OPEN_AT, duration: 0.7, ease: inOutQuint })
        .to(r, { prop: "alpha", from: 1, to: 0.25, start: OPEN_AT, duration: 0.6, ease: outQuad });
    });
  }

  // --- The letter: a row that grows into an open email ---
  const letter = new Container();
  stack.addChild(letter);

  const openH = rowH * 4.6;
  const body = new Graphics()
    .roundRect(-cardW / 2, -rowH / 2, cardW, rowH, bodySize * 0.55)
    .fill(bg)
    .stroke({ color: textColor, width: Math.max(1, size.width * 0.0012), alpha: 0.14 });
  letter.addChild(body);
  // The card's height is animated via scale.y on a holder rather than by
  // redrawing geometry, so the whole open stays a pure function of t.
  const grow = new Container();
  letter.addChild(grow);
  const openBody = new Graphics()
    .roundRect(-cardW / 2, -openH / 2, cardW, openH, bodySize * 0.55)
    .fill(bg)
    .stroke({ color: textColor, width: Math.max(1, size.width * 0.0012), alpha: 0.14 });
  grow.addChild(openBody);
  grow.scale.y = 0.02;
  grow.alpha = 0;
  timeline
    .to(grow, { prop: "scale.y", from: 0.02, to: 1, start: OPEN_AT, duration: 0.7, ease: inOutQuint })
    .to(grow, { prop: "alpha", from: 0, to: 1, start: OPEN_AT, duration: 0.2, ease: outQuad })
    .to(body, { prop: "alpha", from: 1, to: 0, start: OPEN_AT, duration: 0.2, ease: outQuad });

  // Sender row, which is present the whole time and just moves up as it opens.
  const head = new Container();
  letter.addChild(head);
  const av = avatar(fonts, { radius: bodySize * 1.05, bg: accent, initial: sender.slice(0, 1).toUpperCase(), textColor: bg });
  av.position.set(-cardW / 2 + pad + bodySize, 0);
  head.addChild(av);
  const s = makeText(fonts, {
    text: sender,
    role: "display",
    weight: 800,
    size: bodySize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  s.position.set(-cardW / 2 + pad + bodySize * 2.6, 0);
  head.addChild(s);
  const dot = new Graphics().circle(cardW / 2 - pad - bodySize * 0.3, 0, bodySize * 0.28).fill(accent);
  head.addChild(dot);
  timeline.to(head, { prop: "y", from: 0, to: -openH / 2 + rowH * 0.55, start: OPEN_AT, duration: 0.7, ease: inOutQuint });

  // Subject + preview + CTA, revealed inside the opened card.
  const inner = new Container();
  letter.addChild(inner);
  const measure = (t: string, sz: number) => fonts.measure(t, { family: fonts.family("display"), weight: 800, size: sz });
  let subjSize = bodySize * 1.4;
  let subjLines: string[] = [];
  for (let guard = 0; guard < 10; guard++) {
    subjLines = [];
    let cur = "";
    for (const w of subject.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${w}` : w;
      if (measure(next, subjSize) <= cardW - pad * 2 || !cur) cur = next;
      else {
        subjLines.push(cur);
        cur = w;
      }
    }
    if (cur) subjLines.push(cur);
    if (subjLines.length <= 2) break;
    subjSize = Math.round(subjSize * 0.92);
  }
  const subjTop = -openH / 2 + rowH * 1.5;
  subjLines.forEach((line, i) => {
    const t = makeText(fonts, {
      text: line,
      role: "display",
      weight: 800,
      size: subjSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.position.set(-cardW / 2 + pad, subjTop + subjSize * 1.3 * i);
    inner.addChild(t);
  });

  const previewTop = subjTop + subjSize * 1.3 * subjLines.length + bodySize * 0.6;
  const pMeasure = (t: string) => fonts.measure(t, { family: fonts.family("body"), weight: 500, size: bodySize * 0.94 });
  const pLines: string[] = [];
  let pcur = "";
  for (const w of preview.split(/\s+/).filter(Boolean)) {
    const next = pcur ? `${pcur} ${w}` : w;
    if (pMeasure(next) <= cardW - pad * 2 || !pcur) pcur = next;
    else {
      pLines.push(pcur);
      pcur = w;
    }
  }
  if (pcur) pLines.push(pcur);
  pLines.slice(0, 3).forEach((line, i) => {
    const t = makeText(fonts, {
      text: line,
      role: "body",
      weight: 500,
      size: bodySize * 0.94,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.alpha = 0.7;
    t.position.set(-cardW / 2 + pad, previewTop + bodySize * 1.35 * i);
    inner.addChild(t);
  });

  if (cta.length > 0) {
    const label = makeText(fonts, { text: cta, role: "display", weight: 800, size: bodySize, color: bg, anchor: 0.5 });
    const w = label.width + bodySize * 2.6;
    const h = bodySize * 2.6;
    const btn = new Container();
    btn.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(accent), label);
    btn.position.set(-cardW / 2 + pad + w / 2, openH / 2 - rowH * 0.8);
    inner.addChild(btn);
    btn.scale.set(0);
    timeline
      .to(btn, { prop: "scale.x", from: 0, to: 1, start: OPEN_AT + 0.75, duration: 0.5, ease: outBack })
      .to(btn, { prop: "scale.y", from: 0, to: 1, start: OPEN_AT + 0.75, duration: 0.5, ease: outBack });
  }

  inner.alpha = 0;
  timeline
    .to(inner, { prop: "alpha", from: 0, to: 1, start: OPEN_AT + 0.45, duration: 0.4, ease: outQuad })
    .to(inner, { prop: "y", from: bodySize * 0.5, to: 0, start: OPEN_AT + 0.45, duration: 0.7, ease: outExpo });

  stack.alpha = 0;
  timeline
    .to(stack, { prop: "alpha", from: 0, to: 1, start: IN_AT, duration: 0.4, ease: outQuad })
    .to(stack, { prop: "y", from: cy + rowH * 0.5, to: cy, start: IN_AT, duration: 0.85, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const emailMockup: TemplateDefinition = {
  id: "email-mockup",
  name: "Email Preview",
  tagline: "An inbox row grows open into your newsletter — subject, first lines and all.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.8,
  fontRoles: { subject: "display", preview: "body" },
  palettes: PALETTES,
  fields: [
    { key: "sender", type: "text", label: "From", default: "Fika Studio", maxLength: 26 },
    {
      key: "subject",
      type: "text",
      label: "Subject",
      default: "Five things we learned shooting in the rain",
      maxLength: 90,
    },
    {
      key: "preview",
      type: "text",
      label: "First lines",
      default: "Plus: the lens we stopped using, and why the client kept the outtakes.",
      maxLength: 160,
    },
    { key: "cta", type: "text", label: "Button", default: "Read it", maxLength: 22, optional: true },
    { key: "showInbox", type: "toggle", label: "Other inbox rows", default: true },
    { key: "background", type: "color", label: "Background & card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
