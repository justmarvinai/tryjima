import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Backspace — types one thing, deletes it, types the real thing. The
// self-correction is the joke and the hook: "Monday. // I mean, Friday."
//
// `typewriter` and `type-cursor` both type forward and stop. This one has three
// beats — type, delete, retype — which is a different piece of comic timing and
// the single most-used text device in short-form social video.
//
// Both strings are laid out up front and revealed by character count from a
// pure `update(t)`, so scrubbing backwards lands on exactly the same frame.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#F7F6F2", textColor: "#15161A", accent: "#E0483C" } },
  { id: "ink", name: "Ink", colors: { background: "#101115", textColor: "#F3F3F1", accent: "#4ADE80" } },
  { id: "notebook", name: "Notebook", colors: { background: "#FAF7EC", textColor: "#1E1B12", accent: "#2563EB" } },
  { id: "punch", name: "Punch", colors: { background: "#FFF1F2", textColor: "#1B0E12", accent: "#DB2777" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.072, maxWidthFrac: 0.78, centerFrac: 0.48 };
    case "9:16":
      return { fontFrac: 0.098, maxWidthFrac: 0.86, centerFrac: 0.47 };
    case "4:5":
      return { fontFrac: 0.09, maxWidthFrac: 0.84, centerFrac: 0.475 };
    case "1:1":
    default:
      return { fontFrac: 0.09, maxWidthFrac: 0.84, centerFrac: 0.475 };
  }
}

const TYPE_RATE = 0.062; // seconds per character typed
const DELETE_RATE = 0.032; // deleting is always faster than typing
const PAUSE_BEFORE_DELETE = 0.65;
const PAUSE_AFTER_DELETE = 0.22;
const TAIL = 1.5;
const LEAD_IN = 0.35;

function timings(wrong: string, right: string): { deleteAt: number; retypeAt: number; doneAt: number; duration: number } {
  const typeWrong = wrong.length * TYPE_RATE;
  const deleteAt = LEAD_IN + typeWrong + PAUSE_BEFORE_DELETE;
  const retypeAt = deleteAt + wrong.length * DELETE_RATE + PAUSE_AFTER_DELETE;
  const doneAt = retypeAt + right.length * TYPE_RATE;
  return { deleteAt, retypeAt, doneAt, duration: Math.min(12, doneAt + TAIL) };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F6F2"));
  const textColor = str(values.textColor, pc("textColor", "#15161A"));
  const accent = str(values.accent, pc("accent", "#E0483C"));
  const wrong = str(values.wrong, "Monday");
  const right = str(values.right, "Friday");
  const label = str(values.label, "").trim();
  const showCursor = on(values.showCursor);
  const strikeWrong = on(values.strikeWrong);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;

  // One size that fits whichever string is longer — the line must not resize
  // mid-animation, or the correction reads as a layout bug.
  let fontSize = Math.round(size.width * L.fontFrac);
  const widest = () => {
    const style = { family: fonts.family("display"), weight: 700, size: fontSize };
    return Math.max(fonts.measure(wrong, style), fonts.measure(right, style));
  };
  for (let guard = 0; guard < 24 && widest() > maxWidth; guard++) fontSize = Math.round(fontSize * 0.94);

  const T = timings(wrong, right);
  const timeline = new JimaTimeline();

  const line = new Container();
  line.position.set(cx, centerY);
  root.addChild(line);

  // Left-anchored text inside a centred holder: the holder recentres as the
  // string changes length, so the line stays optically centred while typing.
  const style = { family: fonts.family("display"), weight: 700, size: fontSize };
  const typed: Text = makeText(fonts, {
    text: "",
    role: "display",
    weight: 700,
    size: fontSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  line.addChild(typed);

  const caretW = Math.max(3, Math.round(fontSize * 0.055));
  const caret = new Graphics().rect(0, -fontSize * 0.44, caretW, fontSize * 0.88).fill(accent);
  if (showCursor) line.addChild(caret);

  // A rule that strikes through the wrong word just before it is deleted.
  const strike = new Graphics().rect(0, 0, 1, Math.max(3, fontSize * 0.06)).fill(accent);
  strike.alpha = 0;
  if (strikeWrong) line.addChild(strike);

  if (label.length > 0) {
    const lab = makeText(fonts, {
      text: label.toUpperCase(),
      role: "body",
      weight: 700,
      size: Math.round(size.width * 0.018),
      color: accent,
      anchor: 0.5,
      letterSpacing: size.width * 0.004,
    });
    const labY = centerY - fontSize * 1.05;
    lab.position.set(cx, labY);
    lab.alpha = 0;
    root.addChild(lab);
    timeline
      .to(lab, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad })
      .to(lab, { prop: "y", from: labY + fontSize * 0.2, to: labY, start: 0.1, duration: 0.7, ease: outExpo });
  }

  // A settle-in nudge once the right word is complete, so the correction lands.
  const under = new Graphics().rect(0, 0, 1, Math.max(3, fontSize * 0.07)).fill(accent);
  under.alpha = 0;
  root.addChild(under);
  // Only alpha is tweened here: its length is driven from `update` via `width`,
  // and `width` writes `scale.x`, so tweening both would fight.
  timeline.to(under, { prop: "alpha", from: 0, to: 1, start: T.doneAt + 0.12, duration: 0.3, ease: outQuad });

  // Pure function of t: how many characters of which string are on screen.
  const update = (t: number): void => {
    let text: string;
    let striking = 0;
    if (t < T.deleteAt) {
      const n = Math.floor(Math.max(0, t - LEAD_IN) / TYPE_RATE);
      text = wrong.slice(0, Math.min(n, wrong.length));
      // The strike sweeps across the finished wrong word during the pause.
      const pauseU = (t - (T.deleteAt - PAUSE_BEFORE_DELETE)) / (PAUSE_BEFORE_DELETE * 0.8);
      striking = text.length === wrong.length ? Math.max(0, Math.min(1, pauseU)) : 0;
    } else if (t < T.retypeAt) {
      const gone = Math.floor((t - T.deleteAt) / DELETE_RATE);
      text = wrong.slice(0, Math.max(0, wrong.length - gone));
      striking = text.length > 0 ? 1 : 0;
    } else {
      const n = Math.floor((t - T.retypeAt) / TYPE_RATE);
      text = right.slice(0, Math.min(n, right.length));
    }

    typed.text = text;
    const w = text.length ? fonts.measure(text, style) : 0;
    typed.x = -w / 2;
    caret.x = w / 2 + fontSize * 0.06;
    // A steady blink that keeps ticking while idle, on a 1.06s period so it
    // never syncs with the typing rate and reads mechanical.
    caret.alpha = showCursor ? (t % 1.06 < 0.62 ? 1 : 0.12) : 0;

    strike.alpha = strikeWrong ? striking * 0.95 : 0;
    strike.width = Math.max(1, w * striking);
    strike.x = -w / 2;
    strike.y = -fontSize * 0.04;

    const rightW = fonts.measure(right, style);
    const doneU = Math.max(0, Math.min(1, (t - T.doneAt - 0.12) / 0.55));
    // outExpo by hand — `update` runs outside the timeline's easing.
    const eased = doneU >= 1 ? 1 : 1 - Math.pow(2, -10 * doneU);
    under.width = Math.max(1, rightW * eased);
    under.x = cx - rightW / 2;
    under.y = centerY + fontSize * 0.62;
  };
  update(0);

  return { timeline, duration: T.duration, update };
}

export const backspaceFix: TemplateDefinition = {
  id: "backspace-fix",
  name: "Backspace",
  tagline: "Types one thing, deletes it, types the real thing — the correction is the punchline.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { headline: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "wrong", type: "text", label: "First (wrong) word", default: "Monday", maxLength: 28 },
    { key: "right", type: "text", label: "Corrected word", default: "Friday", maxLength: 28 },
    { key: "label", type: "text", label: "Label", default: "Best day to post", maxLength: 30, optional: true },
    { key: "showCursor", type: "toggle", label: "Cursor", default: true },
    { key: "strikeWrong", type: "toggle", label: "Strike the mistake", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  estimateDuration: (v) => timings(str(v.wrong, "Monday"), str(v.right, "Friday")).duration,
  build,
};
