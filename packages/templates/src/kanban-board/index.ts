import { Container, Graphics, type Text } from "pixi.js";
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

// Kanban Board — columns fill with cards, then one card visibly *moves* from
// one column to the next and the counts update. The "how we work" post, and
// the only template where the payload is a state change rather than an arrival.
//
// Cards are "Text | column" (1-based). The moving card is chosen by index and
// travels to the column on its right, which is the entire story of a board.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "board", name: "Board", colors: { background: "#EEF0F4", textColor: "#161A20", accent: "#2563EB" } },
  { id: "ink", name: "Ink", colors: { background: "#111318", textColor: "#F3F4F7", accent: "#60A5FA" } },
  { id: "mint", name: "Mint", colors: { background: "#EDF5F0", textColor: "#0F1E17", accent: "#0F9D6E" } },
  { id: "amber", name: "Amber", colors: { background: "#FAF4E9", textColor: "#1E1811", accent: "#B45309" } },
];

interface Layout {
  cardFrac: number;
  topFrac: number;
  widthFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.02, topFrac: 0.2, widthFrac: 0.82 };
    case "9:16":
      return { cardFrac: 0.031, topFrac: 0.24, widthFrac: 0.92 };
    case "4:5":
      return { cardFrac: 0.028, topFrac: 0.21, widthFrac: 0.9 };
    case "1:1":
    default:
      return { cardFrac: 0.027, topFrac: 0.21, widthFrac: 0.9 };
  }
}

const HEAD_AT = 0.2;
const CARDS_AT = 0.7;
const PER_CARD = 0.13;
const MOVE_AT = 2.1;
const DURATION = 5.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF0F4"));
  const textColor = str(values.textColor, pc("textColor", "#161A20"));
  const accent = str(values.accent, pc("accent", "#2563EB"));
  const title = str(values.title, "This sprint");
  const cols = (Array.isArray(values.columns) ? (values.columns as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);
  const rows = (Array.isArray(values.cards) ? (values.cards as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const moveIndex = Math.round(num(values.moveCard, 1));
  const showMove = on(values.showMove);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cardSize = Math.round(size.width * L.cardFrac);
  const boardW = size.width * L.widthFrac;
  const n = Math.max(1, cols.length);
  const gap = boardW * 0.03;
  const colW = (boardW - gap * (n - 1)) / n;
  const left = cx - boardW / 2;
  const top = size.height * L.topFrac;
  const cardH = cardSize * 3.6;
  const cardGap = cardSize * 0.7;
  const headerH = cardSize * 3.2;

  const timeline = new JimaTimeline();

  const titleSize = Math.round(cardSize * 2.1);
  const t = makeText(fonts, { text: title, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  if (t.width > boardW) t.scale.set(boardW / t.width);
  const titleY = top - titleSize * 0.9;
  t.position.set(cx, titleY);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: HEAD_AT, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: titleY + titleSize * 0.3, to: titleY, start: HEAD_AT, duration: 0.75, ease: outExpo });

  // Group the cards by column so each lane can be laid out and counted.
  const lanes: { text: string; col: number }[][] = Array.from({ length: n }, () => []);
  rows.forEach((raw) => {
    const [textPart, colPart] = raw.split("|").map((s) => s.trim());
    const col = Math.max(1, Math.min(n, Math.round(Number(colPart) || 1))) - 1;
    lanes[col]!.push({ text: textPart ?? raw, col });
  });

  // Column headers + counts. The counts are set from the *final* state so the
  // move can decrement one and increment the next without a second source.
  const counts: { text: Text; base: number; col: number }[] = [];
  const colX = (i: number) => left + (colW + gap) * i;

  cols.forEach((label, i) => {
    const x = colX(i);
    const lane = new Container();
    lane.position.set(x, top);
    root.addChild(lane);

    // Every lane is sized for one more card than it starts with, so the one
    // that moves in still lands inside its column rather than below it.
    const laneRows = Math.max(1, lanes[i]!.length + (showMove ? 1 : 0));
    lane.addChild(
      new Graphics()
        .roundRect(0, 0, colW, headerH + laneRows * (cardH + cardGap) + cardGap, cardSize * 0.6)
        .fill({ color: textColor, alpha: 0.05 }),
    );

    const head = makeText(fonts, {
      text: label,
      role: "display",
      weight: 800,
      size: cardSize * 1.05,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    head.position.set(cardSize, headerH * 0.45);
    lane.addChild(head);

    const cnt = makeText(fonts, {
      text: String(lanes[i]!.length),
      role: "body",
      weight: 800,
      size: cardSize * 0.95,
      color: bg,
      anchor: 0.5,
    });
    const badge = new Container();
    badge.addChild(new Graphics().circle(0, 0, cardSize * 0.9).fill(i === 0 ? textColor : accent), cnt);
    badge.position.set(colW - cardSize * 1.4, headerH * 0.45);
    badge.alpha = 0.9;
    lane.addChild(badge);
    counts.push({ text: cnt, base: lanes[i]!.length, col: i });

    lane.alpha = 0;
    timeline
      .to(lane, { prop: "alpha", from: 0, to: 1, start: HEAD_AT + 0.2 + i * 0.1, duration: 0.4, ease: outQuad })
      .to(lane, { prop: "y", from: top + cardSize, to: top, start: HEAD_AT + 0.2 + i * 0.1, duration: 0.75, ease: outExpo });
  });

  // --- Cards ---
  let flat = 0;
  const movers: { card: Container; from: number; to: number; toY: number }[] = [];
  lanes.forEach((lane, i) => {
    lane.forEach((item, j) => {
      const x = colX(i) + colW / 2;
      const y = top + headerH + (cardH + cardGap) * j + cardH / 2;
      const card = new Container();
      card.position.set(x, y);
      root.addChild(card);

      card.addChild(
        new Graphics()
          .roundRect(-colW / 2 + cardSize * 0.7, -cardH / 2, colW - cardSize * 1.4, cardH, cardSize * 0.5)
          .fill(bg)
          .stroke({ color: textColor, width: Math.max(1, size.width * 0.0011), alpha: 0.12 }),
      );
      // A coloured spine, which is how every board signals type at a glance.
      card.addChild(
        new Graphics()
          .roundRect(-colW / 2 + cardSize * 0.7, -cardH / 2, cardSize * 0.4, cardH, cardSize * 0.2)
          .fill(i === n - 1 ? accent : textColor),
      );

      const label = makeText(fonts, {
        text: item.text,
        role: "body",
        weight: 600,
        size: cardSize,
        color: textColor,
        anchor: { x: 0, y: 0.5 },
      });
      const room = colW - cardSize * 3.2;
      if (label.width > room) label.scale.set(Math.max(0.5, room / label.width));
      label.position.set(-colW / 2 + cardSize * 1.6, 0);
      card.addChild(label);

      const at = CARDS_AT + flat * PER_CARD;
      flat++;
      card.alpha = 0;
      timeline
        .to(card, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
        .to(card, { prop: "y", from: y + cardH * 0.4, to: y, start: at, duration: 0.6, ease: outExpo })
        .to(card, { prop: "scale.x", from: 0.9, to: 1, start: at, duration: 0.55, ease: outBack })
        .to(card, { prop: "scale.y", from: 0.9, to: 1, start: at, duration: 0.55, ease: outBack });

      // The card that moves: chosen by its flat index, and only if a column to
      // the right exists to receive it.
      if (showMove && flat === Math.max(1, moveIndex) && i < n - 1) {
        const toX = colX(i + 1) + colW / 2;
        const toY = top + headerH + (cardH + cardGap) * lanes[i + 1]!.length + cardH / 2;
        movers.push({ card, from: x, to: toX, toY });
        timeline
          .to(card, { prop: "x", from: x, to: toX, start: MOVE_AT, duration: 0.8, ease: inOutQuint })
          .to(card, { prop: "y", from: y, to: toY, start: MOVE_AT, duration: 0.8, ease: inOutQuint })
          // Lifts off the board and sets back down, which is what a drag is.
          .to(card, { prop: "scale.x", from: 1, to: 1.06, start: MOVE_AT, duration: 0.3, ease: outQuad })
          .to(card, { prop: "scale.y", from: 1, to: 1.06, start: MOVE_AT, duration: 0.3, ease: outQuad })
          .to(card, { prop: "scale.x", from: 1.06, to: 1, start: MOVE_AT + 0.5, duration: 0.4, ease: outExpo })
          .to(card, { prop: "scale.y", from: 1.06, to: 1, start: MOVE_AT + 0.5, duration: 0.4, ease: outExpo });
      }
    });
  });

  // The counts change exactly halfway through the move, which is when the card
  // visually crosses the column boundary.
  const update = (time: number): void => {
    const moved = movers.length > 0 && time > MOVE_AT + 0.45;
    for (const c of counts) {
      let v = c.base;
      if (moved && movers[0]) {
        const fromCol = cols.findIndex((_, i) => colX(i) + colW / 2 === movers[0]!.from);
        if (c.col === fromCol) v -= 1;
        if (c.col === fromCol + 1) v += 1;
      }
      c.text.text = String(v);
    }
  };
  update(0);

  return { timeline, duration: DURATION, update };
}

export const kanbanBoard: TemplateDefinition = {
  id: "kanban-board",
  name: "Kanban Board",
  tagline: "Columns fill with cards, then one moves across and the counts change with it.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { title: "display", cards: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Heading", default: "This sprint", maxLength: 30, shrinkToFit: true },
    {
      key: "columns",
      type: "textlist",
      label: "Columns",
      default: ["To do", "Doing", "Done"],
      minItems: 2,
      maxItems: 3,
      maxLength: 16,
    },
    {
      key: "cards",
      type: "textlist",
      label: "Cards — Text | column",
      default: [
        "Shoot the lookbook | 1",
        "Write launch caption | 1",
        "Edit the reel | 2",
        "Schedule the week | 3",
        "Reply to DMs | 3",
      ],
      minItems: 1,
      maxItems: 8,
      maxLength: 34,
    },
    { key: "moveCard", type: "slider", label: "Card that moves", default: 3, min: 1, max: 8, step: 1 },
    { key: "showMove", type: "toggle", label: "Move a card", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
