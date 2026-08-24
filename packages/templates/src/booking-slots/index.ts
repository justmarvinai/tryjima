import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Book a Slot — a week of appointment times appears as tappable chips, the
// taken ones struck through, one highlighted as the pick. The post every
// hairdresser, tattooist, coach and studio needs and could not make until now.
//
// Prefix a time with `x` to mark it gone: "x 10:00" reads as taken, which is
// the whole persuasion — scarcity you can see.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const PALETTES: Palette[] = [
  { id: "sage", name: "Sage", colors: { background: "#F2F6F2", textColor: "#122019", accent: "#2F7D5B" } },
  { id: "ink", name: "Ink", colors: { background: "#111216", textColor: "#F4F5F7", accent: "#4ADE80" } },
  { id: "blush", name: "Blush", colors: { background: "#FDF2F4", textColor: "#26121A", accent: "#DB2777" } },
  { id: "sand", name: "Sand", colors: { background: "#FAF5EC", textColor: "#1E1A11", accent: "#B45309" } },
];

interface Layout {
  titleFrac: number;
  chipFrac: number;
  widthFrac: number;
  topFrac: number;
  cols: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { titleFrac: 0.05, chipFrac: 0.03, widthFrac: 0.62, topFrac: 0.22, cols: 4 };
    case "9:16":
      return { titleFrac: 0.068, chipFrac: 0.042, widthFrac: 0.84, topFrac: 0.22, cols: 2 };
    case "4:5":
      return { titleFrac: 0.062, chipFrac: 0.038, widthFrac: 0.82, topFrac: 0.21, cols: 3 };
    case "1:1":
    default:
      return { titleFrac: 0.062, chipFrac: 0.036, widthFrac: 0.8, topFrac: 0.22, cols: 3 };
  }
}

const TITLE_AT = 0.2;
const FIRST_AT = 0.7;
const PER_CHIP = 0.11;
const DURATION = 5.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F2F6F2"));
  const textColor = str(values.textColor, pc("textColor", "#122019"));
  const accent = str(values.accent, pc("accent", "#2F7D5B"));
  const title = str(values.title, "This week");
  const subtitle = str(values.subtitle, "").trim();
  const rows = (Array.isArray(values.slots) ? (values.slots as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 9);
  const cta = str(values.cta, "").trim();

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const titleSize = Math.round(size.width * L.titleFrac);
  const chipSize = Math.round(size.width * L.chipFrac);
  const colW = size.width * L.widthFrac;
  const cols = L.cols;
  const gapX = colW * 0.035;
  const cellW = (colW - gapX * (cols - 1)) / cols;
  const cellH = chipSize * 2.6;
  const gapY = chipSize * 0.6;
  const top = size.height * L.topFrac;

  const timeline = new JimaTimeline();

  // --- Heading ---
  const t = makeText(fonts, { text: title, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  if (t.width > colW) t.scale.set(colW / t.width);
  t.position.set(cx, top);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: TITLE_AT, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: top + titleSize * 0.3, to: top, start: TITLE_AT, duration: 0.75, ease: outExpo });

  let listTop = top + titleSize * 0.95;
  if (subtitle.length > 0) {
    const s = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: Math.round(titleSize * 0.42),
      color: textColor,
      anchor: 0.5,
    });
    s.alpha = 0;
    s.position.set(cx, listTop);
    root.addChild(s);
    timeline.to(s, { prop: "alpha", from: 0, to: 0.66, start: TITLE_AT + 0.2, duration: 0.45, ease: outQuad });
    listTop += titleSize * 0.6;
  }
  listTop += chipSize * 1.2;

  // --- Slot chips ---
  rows.forEach((raw, i) => {
    const taken = /^x[\s.:-]/i.test(raw);
    const label = raw.replace(/^x[\s.:-]\s*/i, "").trim();
    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    const x = cx - colW / 2 + (cellW + gapX) * col + cellW / 2;
    const y = listTop + (cellH + gapY) * rowIdx + cellH / 2;

    const chip = new Container();
    chip.position.set(x, y);
    root.addChild(chip);

    const body = new Graphics().roundRect(-cellW / 2, -cellH / 2, cellW, cellH, chipSize * 0.55);
    if (taken) {
      body.fill({ color: textColor, alpha: 0.05 }).stroke({ color: textColor, width: Math.max(1, size.width * 0.0011), alpha: 0.14 });
    } else {
      body.fill({ color: accent, alpha: 0.1 }).stroke({ color: accent, width: Math.max(2, size.width * 0.0018), alpha: 0.75 });
    }
    chip.addChild(body);

    const text = makeText(fonts, {
      text: label,
      role: "display",
      weight: 800,
      size: chipSize,
      color: taken ? textColor : accent,
      anchor: 0.5,
    });
    text.alpha = taken ? 0.38 : 1;
    chip.addChild(text);

    // Taken slots get struck out a beat after they land — you see it go.
    if (taken) {
      const w = text.width * 1.16;
      const line = new Graphics()
        .rect(-w / 2, -Math.max(1, chipSize * 0.045), w, Math.max(2, chipSize * 0.09))
        .fill(textColor);
      line.alpha = 0.45;
      line.scale.x = 0;
      chip.addChild(line);
      timeline.to(line, {
        prop: "scale.x",
        from: 0,
        to: 1,
        start: FIRST_AT + i * PER_CHIP + 0.3,
        duration: 0.3,
        ease: outExpo,
      });
    }

    const at = FIRST_AT + i * PER_CHIP;
    chip.alpha = 0;
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
      .to(chip, { prop: "y", from: y + cellH * 0.5, to: y, start: at, duration: 0.6, ease: outExpo })
      .to(chip, { prop: "scale.x", from: 0.86, to: 1, start: at, duration: 0.55, ease: outBack })
      .to(chip, { prop: "scale.y", from: 0.86, to: 1, start: at, duration: 0.55, ease: outBack });
  });

  const gridRows = Math.ceil(rows.length / cols);
  const gridBottom = listTop + (cellH + gapY) * gridRows;

  // --- CTA ---
  if (cta.length > 0) {
    const ctaSize = Math.round(chipSize * 1.05);
    const label = makeText(fonts, { text: cta, role: "display", weight: 800, size: ctaSize, color: bg, anchor: 0.5 });
    const w = label.width + ctaSize * 2.4;
    const h = ctaSize * 2.5;
    const holder = new Container();
    holder.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(accent), label);
    const y = gridBottom + ctaSize * 1.4;
    holder.position.set(cx, y);
    holder.alpha = 0;
    root.addChild(holder);
    const at = FIRST_AT + rows.length * PER_CHIP + 0.25;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.32, ease: outQuad })
      .to(holder, { prop: "y", from: y + ctaSize * 0.6, to: y, start: at, duration: 0.7, ease: outExpo })
      .to(holder, { prop: "scale.x", from: 0.8, to: 1, start: at, duration: 0.6, ease: outBack })
      .to(holder, { prop: "scale.y", from: 0.8, to: 1, start: at, duration: 0.6, ease: outBack });
  }

  return { timeline, duration: DURATION };
}

export const bookingSlots: TemplateDefinition = {
  id: "booking-slots",
  name: "Book a Slot",
  tagline: "This week's times as chips — the taken ones strike through as you watch.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { title: "display", slots: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Heading", default: "This week", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subheading", default: "Cuts & colour · Studio Nord", maxLength: 44, optional: true },
    {
      key: "slots",
      type: "textlist",
      label: "Slots (prefix with x if taken)",
      default: ["x Tue 10:00", "Tue 14:30", "x Wed 09:00", "Wed 16:00", "Thu 11:30", "Fri 15:00"],
      minItems: 1,
      maxItems: 9,
      maxLength: 20,
    },
    { key: "cta", type: "text", label: "Button", default: "Book in bio", maxLength: 24, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Available", default: "", optional: true },
  ],
  build,
};
