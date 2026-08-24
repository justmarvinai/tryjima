/**
 * FontFace loader. Works on the main thread AND inside a worker (the export
 * pipeline loads fonts here because a worker can't read the document's
 * @font-face rules). Both contexts expose a `FontFaceSet` — `document.fonts` in
 * a window, `self.fonts` in a worker — so we resolve whichever exists.
 */
import { FONTS, type FontDef } from './registry';

type FontFaceSetLike = {
  add: (font: FontFace) => void;
  has: (font: FontFace) => boolean;
  ready: Promise<unknown>;
};

function fontFaceSet(): FontFaceSetLike | undefined {
  const scope = globalThis as unknown as { fonts?: FontFaceSetLike };
  return scope.fonts;
}

const loaded = new Map<string, Promise<void>>();

/** Load a single font by registry key. Idempotent and cached per key. */
export function loadFont(key: string): Promise<void> {
  const def = FONTS[key];
  if (!def) return Promise.reject(new Error(`Unknown font: ${key}`));

  const existing = loaded.get(key);
  if (existing) return existing;

  const promise = loadFontDef(def);
  loaded.set(key, promise);
  return promise;
}

async function loadFontDef(def: FontDef): Promise<void> {
  const set = fontFaceSet();
  if (!set) {
    // No FontFaceSet (e.g. non-browser test env) — nothing to load.
    return;
  }
  const face = new FontFace(def.family, `url(${def.url}) format('woff2')`, {
    weight: String(def.weight),
    style: 'normal',
    display: 'swap',
  });
  await face.load();
  set.add(face);
}

/** Load several fonts by key. Resolves once all are ready. */
export function loadFonts(keys: string[]): Promise<void[]> {
  return Promise.all(keys.map(loadFont));
}

/** Wait for all fonts currently registered on the FontFaceSet to be ready. */
export function fontsReady(): Promise<unknown> {
  return fontFaceSet()?.ready ?? Promise.resolve();
}
