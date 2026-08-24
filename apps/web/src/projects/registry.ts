import { getTemplate } from "@jima/templates";
import type { Aspect } from "@jima/engine";
import {
  clearAllProjects,
  deleteProject as deleteMotionProject,
  listProjects as listMotionProjects,
} from "@/motion/state/persistence";
import {
  clearCaptionsProjects,
  deleteCaptionsProject,
  listCaptionsProjects,
} from "@/captions/state/persistence";
import type { ProductId } from "@/shell/products";

/**
 * One list of everything you have open, across both tools.
 *
 * Each tool owns its own storage — a Motion project and a Captions project have
 * almost nothing in common beyond "you were working on this" — so this module
 * is a *view* over the two, not a third store. That keeps each tool's
 * persistence honest about what it can actually save (Motion: everything;
 * Captions: everything except the video itself) while still giving one page
 * that answers "what was I doing?".
 */
export interface ProjectEntry {
  /** Unique across both tools — the kind is part of the key. */
  key: string;
  kind: ProductId;
  /** Underlying id: a template id for Motion, a file identity for Captions. */
  id: string;
  title: string;
  /** One line of context: aspect ratio, or duration and caption count. */
  detail: string;
  updatedAt: number;
  /** Where "open" goes. */
  href: string;
  /** Captions only — a stored JPEG frame. Motion posters render on demand. */
  thumbnail?: string;
  /** Motion only — everything needed to render a live poster for the card. */
  motion?: { templateId: string; aspect: Aspect; paletteId?: string };
  /** True when the project can't be fully restored without user action. */
  needsFile?: boolean;
}

const ASPECT_LABEL: Record<Aspect, string> = {
  "1:1": "Square · 1:1",
  "4:5": "Portrait · 4:5",
  "9:16": "Vertical · 9:16",
  "16:9": "Landscape · 16:9",
};

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Every saved project from both tools, most recently edited first. */
export function listAllProjects(): ProjectEntry[] {
  const motion: ProjectEntry[] = listMotionProjects().flatMap((p) => {
    const def = getTemplate(p.templateId);
    // A saved project whose template no longer exists (renamed or retired) is
    // unopenable — skip it rather than render a card that goes nowhere.
    if (!def) return [];
    return [
      {
        key: `motion:${p.templateId}`,
        kind: "motion" as const,
        id: p.templateId,
        title: def.name,
        detail: ASPECT_LABEL[p.aspect],
        updatedAt: p.updatedAt,
        href: `/motion?t=${p.templateId}`,
        motion: {
          templateId: p.templateId,
          aspect: p.aspect,
          ...(p.paletteId ? { paletteId: p.paletteId } : {}),
        },
      },
    ];
  });

  const captions: ProjectEntry[] = listCaptionsProjects().map((p) => ({
    key: `captions:${p.id}`,
    kind: "captions" as const,
    id: p.id,
    title: p.fileName,
    detail: `${formatDuration(p.durationSec)} · ${p.cues.length} caption${p.cues.length === 1 ? "" : "s"}`,
    updatedAt: p.updatedAt,
    href: `/captions?p=${encodeURIComponent(p.id)}`,
    ...(p.thumbnail ? { thumbnail: p.thumbnail } : {}),
    // The transcript and style are saved; the video is not, by design.
    needsFile: true,
  }));

  return [...motion, ...captions].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Delete one project from whichever tool owns it. */
export async function deleteProjectEntry(entry: ProjectEntry): Promise<void> {
  if (entry.kind === "motion") await deleteMotionProject(entry.id);
  else deleteCaptionsProject(entry.id);
}

/** Wipe every saved project from both tools. Does not touch the brand kit. */
export async function deleteAllProjects(): Promise<void> {
  await clearAllProjects();
  clearCaptionsProjects();
}

/** Human "2 hours ago" for the project cards. */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
