import { create } from "zustand";
import {
  resolveValues,
  THEME_KEYS,
  themePreset,
  type Aspect,
  type SoundPack,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

export interface EditableState {
  templateId: string | null;
  aspect: Aspect;
  paletteId: string | undefined;
  values: Values;
  speed: number;
  /** Motion energy 0–2 (1 = as authored): how punchy vs. calm the motion feels. */
  energy: number;
  /** Seconds cut off the front of the animation. */
  trim: number;
  /** Seconds the last frame is held on the end. */
  hold: number;
  loop: boolean;
  /** Headline font id (FONT_CHOICES); undefined = template default. */
  font: string | undefined;
  /** Body/caption font id (BODY_FONT_CHOICES); undefined = template default. */
  bodyFont: string | undefined;
}

/**
 * A reusable set of brand choices, saved globally (not per-template) so a user
 * can carry their colors + fonts across templates in one click. Lives in
 * localStorage like the sound preference — still nothing leaves the browser.
 */
export interface BrandKit {
  background?: string;
  textColor?: string;
  accent?: string;
  font?: string;
  bodyFont?: string;
  savedAt: number;
}

interface MotionStore extends EditableState {
  def: TemplateDefinition | null;
  past: EditableState[];
  future: EditableState[];
  lastEditKey: string | null;
  lastEditAt: number;
  /** Global sound preference (persisted, not per-template, not undoable). */
  sound: boolean;
  /** Procedural music bed under the effects — a preference, like sound. */
  music: boolean;
  soundPack: SoundPack;
  /** Saved brand kit (global, persisted, not undoable). */
  brandKit: BrandKit | null;

  openTemplate: (def: TemplateDefinition, initial?: Partial<EditableState>) => void;
  setValue: (key: string, value: unknown) => void;
  setAspect: (aspect: Aspect) => void;
  setPalette: (paletteId: string | undefined) => void;
  setFont: (font: string | undefined) => void;
  setBodyFont: (font: string | undefined) => void;
  /** Apply a global theme preset to whichever core color fields exist. */
  applyTheme: (themeId: string) => void;
  setSpeed: (speed: number) => void;
  setEnergy: (energy: number) => void;
  setTrim: (trim: number) => void;
  setHold: (hold: number) => void;
  setLoop: (loop: boolean) => void;
  setSound: (on: boolean) => void;
  setMusic: (on: boolean) => void;
  setSoundPack: (pack: SoundPack) => void;
  saveBrandKit: () => void;
  applyBrandKit: () => void;
  clearBrandKit: () => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  close: () => void;
}

const SOUND_KEY = "jima.sound";
const MUSIC_KEY = "jima.music";
const PACK_KEY = "jima.soundPack";
const BRAND_KEY = "jima.brandKit";

function readBrandKit(): BrandKit | null {
  try {
    const raw = readPref(BRAND_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const k = p as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);
    const kit: BrandKit = { savedAt: typeof k.savedAt === "number" ? k.savedAt : 0 };
    for (const f of ["background", "textColor", "accent", "font", "bodyFont"] as const) {
      const v = str(k[f]);
      if (v) kit[f] = v;
    }
    return kit;
  } catch {
    return null; // corrupt entry — behave as if nothing was saved
  }
}

/*
 * `typeof localStorage !== "undefined"` is NOT a sufficient guard. A browser
 * set to block site data (Safari's private mode, "block all cookies") still
 * exposes the object and THROWS on access — and these run while the store
 * module is being evaluated, so an unguarded read took the whole Motion route
 * down with it rather than losing a preference. Everything else in this app
 * (favourites, project persistence) already reads and writes through a
 * try/catch; these three were the outliers.
 */
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Blocked or full — the preference just doesn't survive the session.
  }
}

function readMusicPref(): boolean {
  return readPref(MUSIC_KEY) === "1"; // default off — it is an addition
}

function readSoundPref(): boolean {
  return readPref(SOUND_KEY) !== "0"; // default on
}

function readPackPref(): SoundPack {
  const v = readPref(PACK_KEY);
  return v === "soft" || v === "retro" || v === "pop" ? v : "pop";
}

const HISTORY_LIMIT = 50;
const COALESCE_MS = 700;

/**
 * Palettes are presets: selecting one fills the template's color fields from the
 * palette's colors (matched by field key). Keeps a single source of truth in
 * `values` so the inspector always shows concrete swatches.
 */
function paletteColorValues(def: TemplateDefinition, paletteId: string | undefined): Values {
  const palette = def.palettes.find((p) => p.id === paletteId) ?? def.palettes[0];
  if (!palette) return {};
  const out: Values = {};
  for (const f of def.fields) {
    if (f.type === "color" && palette.colors[f.key] !== undefined) out[f.key] = palette.colors[f.key];
  }
  return out;
}

function snapshot(s: EditableState): EditableState {
  return {
    templateId: s.templateId,
    aspect: s.aspect,
    paletteId: s.paletteId,
    values: { ...s.values },
    speed: s.speed,
    energy: s.energy,
    trim: s.trim,
    hold: s.hold,
    loop: s.loop,
    font: s.font,
    bodyFont: s.bodyFont,
  };
}

export const useMotionStore = create<MotionStore>((set, get) => ({
  templateId: null,
  aspect: "1:1",
  paletteId: undefined,
  values: {},
  speed: 1,
  energy: 1,
  trim: 0,
  hold: 0,
  loop: false,
  font: undefined,
  bodyFont: undefined,
  def: null,
  past: [],
  future: [],
  lastEditKey: null,
  lastEditAt: 0,
  sound: readSoundPref(),
  music: readMusicPref(),
  soundPack: readPackPref(),
  brandKit: readBrandKit(),

  openTemplate: (def, initial) => {
    const paletteId = initial?.paletteId ?? def.palettes[0]?.id;
    // Merge saved values OVER the full default base so a project saved before a
    // template gained a new field still shows that field's default (not a blank
    // control) in the inspector.
    const base = { ...resolveValues(def), ...paletteColorValues(def, paletteId) };
    const values = initial?.values ? { ...base, ...initial.values } : base;
    set({
      def,
      templateId: def.id,
      aspect: initial?.aspect ?? def.defaultAspect,
      paletteId,
      values,
      speed: initial?.speed ?? 1,
      energy: initial?.energy ?? 1,
      trim: initial?.trim ?? 0,
      hold: initial?.hold ?? 0,
      loop: initial?.loop ?? def.loopable,
      font: initial?.font ?? undefined,
      bodyFont: initial?.bodyFont ?? undefined,
      past: [],
      future: [],
      lastEditKey: null,
      lastEditAt: 0,
    });
  },

  setValue: (key, value) => {
    const s = get();
    const now = Date.now();
    const coalesce = s.lastEditKey === key && now - s.lastEditAt < COALESCE_MS;
    set({
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      values: { ...s.values, [key]: value },
      lastEditKey: key,
      lastEditAt: now,
    });
  },

  setAspect: (aspect) => {
    const s = get();
    if (aspect === s.aspect) return;
    set({ past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [], aspect, lastEditKey: null });
  },

  setPalette: (paletteId) => {
    const s = get();
    if (paletteId === s.paletteId || !s.def) return;
    set({
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      paletteId,
      values: { ...s.values, ...paletteColorValues(s.def, paletteId) },
      lastEditKey: null,
    });
  },

  setFont: (font) => {
    const s = get();
    if (font === s.font) return;
    set({ past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [], font, lastEditKey: null });
  },

  setBodyFont: (bodyFont) => {
    const s = get();
    if (bodyFont === s.bodyFont) return;
    set({ past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [], bodyFont, lastEditKey: null });
  },

  // Theme presets are cross-template: they drive only the three color fields
  // that virtually every template declares by convention, and skip any a given
  // template doesn't have. Bespoke keys (card fills, bubble tints…) are left
  // alone, so a preset can't break a layout it doesn't understand. Selecting one
  // clears `paletteId` — the colors no longer match the template's own preset.
  applyTheme: (themeId) => {
    const s = get();
    const theme = themePreset(themeId);
    if (!theme || !s.def) return;
    const keys = new Set(s.def.fields.filter((f) => f.type === "color").map((f) => f.key));
    const next: Values = {};
    if (keys.has(THEME_KEYS.background)) next[THEME_KEYS.background] = theme.background;
    if (keys.has(THEME_KEYS.text)) next[THEME_KEYS.text] = theme.text;
    if (keys.has(THEME_KEYS.accent)) next[THEME_KEYS.accent] = theme.accent;
    if (Object.keys(next).length === 0) return;
    set({
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      paletteId: undefined,
      values: { ...s.values, ...next },
      lastEditKey: null,
    });
  },

  setSpeed: (speed) => {
    const s = get();
    const clamped = Math.max(0.25, Math.min(3, speed));
    if (clamped === s.speed) return;
    // Dragging the speed slider fires a change per step; coalesce them into a
    // single undo entry (like setValue) so one drag doesn't push dozens of
    // snapshots and evict the rest of the 50-entry history.
    const now = Date.now();
    const coalesce = s.lastEditKey === "__speed" && now - s.lastEditAt < COALESCE_MS;
    set({
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      speed: clamped,
      lastEditKey: "__speed",
      lastEditAt: now,
    });
  },

  setEnergy: (energy) => {
    const s = get();
    const clamped = Math.max(0, Math.min(2, energy));
    if (clamped === s.energy) return;
    // Coalesced like speed — one drag is one undo entry.
    const now = Date.now();
    const coalesce = s.lastEditKey === "__energy" && now - s.lastEditAt < COALESCE_MS;
    set({
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      energy: clamped,
      lastEditKey: "__energy",
      lastEditAt: now,
    });
  },

  // Trim and hold reshape the output clock, not the motion. Coalesced per drag
  // like the other sliders.
  setTrim: (trim) => {
    const s = get();
    const clamped = Math.max(0, Math.min(30, trim));
    if (clamped === s.trim) return;
    const now = Date.now();
    const coalesce = s.lastEditKey === "__trim" && now - s.lastEditAt < COALESCE_MS;
    set({
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      trim: clamped,
      lastEditKey: "__trim",
      lastEditAt: now,
    });
  },

  setHold: (hold) => {
    const s = get();
    const clamped = Math.max(0, Math.min(10, hold));
    if (clamped === s.hold) return;
    const now = Date.now();
    const coalesce = s.lastEditKey === "__hold" && now - s.lastEditAt < COALESCE_MS;
    set({
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      hold: clamped,
      lastEditKey: "__hold",
      lastEditAt: now,
    });
  },

  setLoop: (loop) => {
    const s = get();
    // Guarded like setAspect/setPalette/setFont — without it, re-selecting the
    // current value pushed an undo entry that undoes to itself.
    if (loop === s.loop) return;
    set({ past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [], loop, lastEditKey: null });
  },

  // Sound is a global preference (like volume): persisted, and kept out of the
  // per-template undo history and snapshots.
  setMusic: (on) => {
    writePref(MUSIC_KEY, on ? "1" : "0");
    set({ music: on });
  },

  setSound: (on) => {
    writePref(SOUND_KEY, on ? "1" : "0");
    set({ sound: on });
  },
  setSoundPack: (pack) => {
    writePref(PACK_KEY, pack);
    set({ soundPack: pack });
  },

  // Brand kit: capture the current core colors + fonts as a reusable set. Global
  // and persisted (like the sound preference), so it survives switching
  // templates — that's the whole point — and stays out of the undo history.
  saveBrandKit: () => {
    const s = get();
    const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);
    const kit: BrandKit = { savedAt: Date.now() };
    const bg = str(s.values[THEME_KEYS.background]);
    const text = str(s.values[THEME_KEYS.text]);
    const accent = str(s.values[THEME_KEYS.accent]);
    if (bg) kit.background = bg;
    if (text) kit.textColor = text;
    if (accent) kit.accent = accent;
    if (s.font) kit.font = s.font;
    if (s.bodyFont) kit.bodyFont = s.bodyFont;
    // Storage full / blocked — keep it in memory for this session.
    writePref(BRAND_KEY, JSON.stringify(kit));
    set({ brandKit: kit });
  },

  applyBrandKit: () => {
    const s = get();
    const kit = s.brandKit;
    if (!kit || !s.def) return;
    const keys = new Set(s.def.fields.filter((f) => f.type === "color").map((f) => f.key));
    const next: Values = {};
    if (kit.background && keys.has(THEME_KEYS.background)) next[THEME_KEYS.background] = kit.background;
    if (kit.textColor && keys.has(THEME_KEYS.text)) next[THEME_KEYS.text] = kit.textColor;
    if (kit.accent && keys.has(THEME_KEYS.accent)) next[THEME_KEYS.accent] = kit.accent;
    const fontChanged = kit.font !== undefined && kit.font !== s.font;
    const bodyChanged = kit.bodyFont !== undefined && kit.bodyFont !== s.bodyFont;
    if (Object.keys(next).length === 0 && !fontChanged && !bodyChanged) return;
    set({
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      ...(Object.keys(next).length > 0 ? { paletteId: undefined, values: { ...s.values, ...next } } : {}),
      ...(fontChanged ? { font: kit.font } : {}),
      ...(bodyChanged ? { bodyFont: kit.bodyFont } : {}),
      lastEditKey: null,
    });
  },

  clearBrandKit: () => {
    try {
      localStorage.removeItem(BRAND_KEY);
    } catch {
      /* blocked — the in-memory clear below is what matters */
    }
    set({ brandKit: null });
  },

  reset: () => {
    const s = get();
    if (!s.def) return;
    const paletteId = s.def.palettes[0]?.id;
    set({
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      // Mirror openTemplate: overlay the palette colors so the inspector shows
      // concrete swatches, not blank color fields, after a reset.
      values: { ...resolveValues(s.def), ...paletteColorValues(s.def, paletteId) },
      paletteId,
      // Every knob the Motion tab owns, not just some of them. Speed, font and
      // loop were restored here while energy, trim and hold silently were not —
      // so "Reset template" handed back a template that was still trimmed, still
      // held and still at the wrong energy. Aspect is a canvas/output choice and
      // is intentionally preserved.
      speed: 1,
      energy: 1,
      trim: 0,
      hold: 0,
      font: undefined,
      bodyFont: undefined,
      loop: s.def.loopable,
      lastEditKey: null,
      lastEditAt: 0,
    });
  },

  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      past: s.past.slice(0, -1),
      future: [snapshot(s), ...s.future].slice(0, HISTORY_LIMIT),
      ...prev,
      lastEditKey: null,
    });
  },

  redo: () => {
    const s = get();
    const next = s.future[0];
    if (!next) return;
    set({
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: s.future.slice(1),
      ...next,
      lastEditKey: null,
    });
  },

  close: () => {
    set({ def: null, templateId: null, past: [], future: [], lastEditKey: null });
  },
}));

export function canUndo(s: MotionStore): boolean {
  return s.past.length > 0;
}
export function canRedo(s: MotionStore): boolean {
  return s.future.length > 0;
}
