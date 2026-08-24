import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * These exist because of one shipped bug: the loader looked for the FontFaceSet
 * at `globalThis.fonts` only. That is where a *worker* keeps it. A window keeps
 * it on `document`, so on the main thread the lookup found nothing, the loader
 * took its "no FontFaceSet, nothing to do" branch, and every caption in the
 * editor preview silently rendered in a fallback face while the export worker
 * rendered the real one.
 *
 * The module caches per key in a module-level Map, so each case re-imports it
 * with `vi.resetModules()` and uses a distinct font key.
 */

type Face = { family: string; weight: string; load: () => Promise<void> };

function fakeSet() {
  const added: Face[] = [];
  return {
    added,
    set: {
      add: (f: unknown) => void added.push(f as Face),
      has: () => false,
      ready: Promise.resolve(),
    },
  };
}

const g = globalThis as unknown as {
  FontFace?: unknown;
  fonts?: unknown;
  document?: unknown;
};

let savedFontFace: unknown;
let savedFonts: unknown;
let savedDocument: unknown;

beforeEach(() => {
  savedFontFace = g.FontFace;
  savedFonts = g.fonts;
  savedDocument = g.document;
  // Minimal stand-in: the real one is a browser class, and Node has none.
  g.FontFace = class {
    family: string;
    weight: string;
    constructor(family: string, _src: string, desc: { weight?: string }) {
      this.family = family;
      this.weight = desc.weight ?? '400';
    }
    load() {
      return Promise.resolve(this);
    }
  };
  vi.resetModules();
});

afterEach(() => {
  g.FontFace = savedFontFace;
  g.fonts = savedFonts;
  g.document = savedDocument;
});

describe('loadFont', () => {
  it('registers the face on document.fonts in a window', async () => {
    const doc = fakeSet();
    g.document = { fonts: doc.set };
    delete g.fonts;

    const { loadFont } = await import('./loader');
    await loadFont('anton-400');

    expect(doc.added.map((f) => f.family)).toEqual(['Anton']);
    expect(doc.added[0]!.weight).toBe('400');
  });

  it('registers the face on self.fonts in a worker, where there is no document', async () => {
    const worker = fakeSet();
    delete g.document;
    g.fonts = worker.set;

    const { loadFont } = await import('./loader');
    await loadFont('archivo-900');

    expect(worker.added.map((f) => f.family)).toEqual(['Archivo']);
  });

  it('prefers the document set when both exist, so a window never loads into a stale global', async () => {
    const doc = fakeSet();
    const other = fakeSet();
    g.document = { fonts: doc.set };
    g.fonts = other.set;

    const { loadFont } = await import('./loader');
    await loadFont('inter-700');

    expect(doc.added).toHaveLength(1);
    expect(other.added).toHaveLength(0);
  });

  it('rejects an unknown key rather than resolving to nothing', async () => {
    g.document = { fonts: fakeSet().set };
    const { loadFont } = await import('./loader');
    await expect(loadFont('not-a-font')).rejects.toThrow(/Unknown font/);
  });

  it('loads each key once', async () => {
    const doc = fakeSet();
    g.document = { fonts: doc.set };
    const { loadFont } = await import('./loader');
    await Promise.all([loadFont('anton-400'), loadFont('anton-400')]);
    await loadFont('anton-400');
    expect(doc.added).toHaveLength(1);
  });
});
