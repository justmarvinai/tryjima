import type { Cue } from "@jima/captions/captions";
import type { CaptionStyle } from "@jima/captions/captions";
import type { Language } from "@jima/captions/transcribe";

/**
 * Saved Jima Captions projects.
 *
 * What is saved: the transcript you corrected, the style you built, the
 * language, and enough about the source file to recognise it again.
 *
 * What is NOT saved: the video. That is deliberate, and it is the honest
 * position rather than a limitation we're apologising for — a 200 MB file has
 * no business in browser storage, and Jima's whole promise is that your footage
 * stays a file on your disk. Resuming therefore asks you to pick the same file
 * again, and checks its name and size before restoring the transcript, so you
 * never get one video wearing another's captions.
 */
export interface CaptionsProject {
  v: 1;
  id: string;
  /** Source file identity — how a resumed file is matched back to its work. */
  fileName: string;
  fileSize: number;
  durationSec: number;
  width: number;
  height: number;
  cues: Cue[];
  style: CaptionStyle;
  language: Language;
  /** A small JPEG data URL of one frame, for the projects list. */
  thumbnail?: string;
  updatedAt: number;
}

const KEY = "jima.v2.captions.projects";
const MAX_PROJECTS = 20;

/** Identity for a source video: name plus byte length. Stable, and cheap. */
export function captionsProjectId(fileName: string, fileSize: number): string {
  // Encode rather than concatenate raw: a file name can contain anything,
  // including the separator.
  return `${encodeURIComponent(fileName)}:${fileSize}`;
}

function storageAvailable(): boolean {
  try {
    const k = "__jima_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

type ProjectMap = Record<string, CaptionsProject>;

function readMap(): ProjectMap {
  if (!storageAvailable()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ProjectMap = {};
    for (const [id, p] of Object.entries(parsed as ProjectMap)) {
      if (p && p.v === 1 && Array.isArray(p.cues) && typeof p.fileName === "string") out[id] = p;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: ProjectMap): void {
  if (!storageAvailable()) return;
  const entries = Object.entries(map).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  let kept = entries.slice(0, MAX_PROJECTS);
  for (;;) {
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
      return;
    } catch {
      // Over quota. Transcripts are small but thumbnails are not free; drop the
      // oldest and retry rather than losing the whole list.
      if (kept.length <= 1) return;
      kept = kept.slice(0, kept.length - 1);
    }
  }
}

export function saveCaptionsProject(p: Omit<CaptionsProject, "v" | "updatedAt">): void {
  if (!storageAvailable()) return;
  const map = readMap();
  map[p.id] = { v: 1, ...p, updatedAt: Date.now() };
  writeMap(map);
}

export function loadCaptionsProject(id: string): CaptionsProject | null {
  return readMap()[id] ?? null;
}

/** Every saved Captions project, most recently edited first. */
export function listCaptionsProjects(): CaptionsProject[] {
  return Object.values(readMap()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteCaptionsProject(id: string): void {
  const map = readMap();
  if (!map[id]) return;
  delete map[id];
  writeMap(map);
}

export function clearCaptionsProjects(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Grab a small JPEG of the current frame, for the projects list.
 *
 * Deliberately tiny (240px on the long edge, quality 0.6): this ends up in
 * localStorage alongside up to twenty siblings, and a full-size frame would
 * blow the quota after three projects.
 */
export function captureThumbnail(video: HTMLVideoElement): string | undefined {
  try {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return undefined;
    const scale = 240 / Math.max(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    // A tainted canvas (never happens for a local blob URL, but cheap to guard)
    // or an unsupported type — the list just shows a placeholder.
    return undefined;
  }
}
