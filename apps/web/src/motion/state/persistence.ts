import type { Aspect, Values } from "@jima/engine";
import { getBlob, putBlob, deleteBlob, idbAvailable } from "./idb";

// A user image lives as this descriptor in the store; the Blob itself is in
// IndexedDB under `key`. `url` is an object URL for preview (not persisted).
export interface ImageValue {
  __img: true;
  key: string;
  name: string;
  url: string;
}

export function isImageValue(v: unknown): v is ImageValue {
  return typeof v === "object" && v !== null && (v as { __img?: unknown }).__img === true;
}

export interface PersistedProject {
  v: 1;
  templateId: string;
  aspect: Aspect;
  paletteId?: string;
  font?: string;
  bodyFont?: string;
  values: Values;
  speed: number;
  /** Motion energy 0–2. Optional: projects saved before v1.19 predate it. */
  energy?: number;
  /** Seconds trimmed off the front / held on the end. Optional for the same reason. */
  trim?: number;
  hold?: number;
  loop: boolean;
  updatedAt: number;
}

/*
 * Storage layout.
 *
 * Jima Motion used to autosave exactly one project, so editing a second
 * template silently threw the first away. The unified Projects page needs a
 * list, so this is now a map keyed by template id: one saved project per
 * template, newest first when listed. `LEGACY_KEY` is read once and folded in,
 * so anyone with a project saved in the old app finds it here.
 */
const KEY = "jima.v2.motion.projects";
const LEGACY_KEY = "jima.v1.project";

/** Keep the list bounded — a runaway map would eventually blow the quota. */
const MAX_PROJECTS = 40;

export function storageAvailable(): boolean {
  try {
    const k = "__jima_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

type ProjectMap = Record<string, PersistedProject>;

function readMap(): ProjectMap {
  if (!storageAvailable()) return {};
  let map: ProjectMap = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        for (const [id, p] of Object.entries(parsed as ProjectMap)) {
          if (p && p.v === 1 && typeof p.templateId === "string") map[id] = p;
        }
      }
    }
  } catch {
    map = {};
  }

  // One-time migration from the single-project layout.
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as PersistedProject;
      if (parsed?.v === 1 && parsed.templateId && !map[parsed.templateId]) {
        map[parsed.templateId] = parsed;
        localStorage.setItem(KEY, JSON.stringify(map));
      }
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* a corrupt legacy record is not worth failing the app over */
  }

  return map;
}

function writeMap(map: ProjectMap): void {
  if (!storageAvailable()) return;
  // Trim oldest-first if we're over the cap.
  const entries = Object.entries(map).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  const kept = Object.fromEntries(entries.slice(0, MAX_PROJECTS));
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* quota / private mode — silently skip (the editor still works statelessly) */
  }
}

/** Persist project state (strips image object URLs; blobs live in IndexedDB). */
export function saveProject(p: Omit<PersistedProject, "v" | "updatedAt">): void {
  if (!storageAvailable()) return;
  const values: Values = {};
  for (const [k, val] of Object.entries(p.values)) {
    values[k] = isImageValue(val) ? { __img: true, key: val.key, name: val.name } : val;
  }
  const record: PersistedProject = { v: 1, ...p, values, updatedAt: Date.now() };
  const map = readMap();
  map[p.templateId] = record;
  writeMap(map);
}

/** The most recently edited project, for the gallery's "pick up where you left off" card. */
export function loadProject(): PersistedProject | null {
  const all = listProjects();
  return all[0] ?? null;
}

/** The saved project for one template, if there is one. */
export function loadProjectFor(templateId: string): PersistedProject | null {
  return readMap()[templateId] ?? null;
}

/** Every saved Motion project, most recently edited first. */
export function listProjects(): PersistedProject[] {
  return Object.values(readMap()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Rehydrate image object URLs from IndexedDB blobs for the given values. */
export async function resolveImageValues(values: Values): Promise<Values> {
  if (!idbAvailable()) return values;
  const out: Values = { ...values };
  for (const [k, val] of Object.entries(values)) {
    if (val && typeof val === "object" && (val as { __img?: unknown }).__img === true) {
      const ref = val as { key: string; name: string };
      const blob = await getBlob(ref.key);
      if (blob) {
        out[k] = { __img: true, key: ref.key, name: ref.name, url: URL.createObjectURL(blob) };
      } else {
        delete out[k];
      }
    }
  }
  return out;
}

export async function storeImageBlob(key: string, blob: Blob): Promise<void> {
  if (idbAvailable()) await putBlob(key, blob);
}

/**
 * Delete one saved project, and with it any image blobs only it referenced.
 *
 * The blob sweep matters: images are the only thing here that can run to
 * megabytes, and "delete this project" that leaves its photos behind in
 * IndexedDB would quietly break the promise that clearing something clears it.
 */
export async function deleteProject(templateId: string): Promise<void> {
  const map = readMap();
  const doomed = map[templateId];
  if (!doomed) return;
  delete map[templateId];
  writeMap(map);

  if (!idbAvailable()) return;
  // Only remove a blob no surviving project still points at.
  const stillUsed = new Set<string>();
  for (const p of Object.values(map)) {
    for (const val of Object.values(p.values)) {
      if (isImageValue(val)) stillUsed.add(val.key);
    }
  }
  for (const val of Object.values(doomed.values)) {
    if (isImageValue(val) && !stillUsed.has(val.key)) {
      await deleteBlob(val.key).catch(() => {
        /* best effort — a stuck blob must not block the delete */
      });
    }
  }
}

/** Remove every saved Motion project and its images. */
export async function clearAllProjects(): Promise<void> {
  const map = readMap();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  if (!idbAvailable()) return;
  for (const p of Object.values(map)) {
    for (const val of Object.values(p.values)) {
      if (isImageValue(val)) {
        await deleteBlob(val.key).catch(() => {
          /* best effort */
        });
      }
    }
  }
}
