import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTemplate } from "@jima/templates";
import { PosterThumb } from "@/motion/components/PosterThumb";
import { SiteHeader } from "@/shell/SiteHeader";
import { SiteFooter } from "@/shell/SiteFooter";
import { PRODUCTS } from "@/shell/products";
import {
  deleteAllProjects,
  deleteProjectEntry,
  listAllProjects,
  relativeTime,
  type ProjectEntry,
} from "@/projects/registry";
import { storageAvailable } from "@/motion/state/persistence";
import {
  Badge,
  Button,
  buttonClasses,
  cn,
  Container,
  EmptyState,
  Notice,
  Segmented,
  ArrowRightIcon,
  CaptionsIcon,
  FolderIcon,
  MotionIcon,
  TrashIcon,
  UploadIcon,
} from "@/ui";

type Filter = "all" | "captions" | "motion";

/**
 * The unified projects library — Captions and Motion work in one list.
 *
 * Before the merge each tool had its own idea of "the thing you were last
 * working on", and neither had a list. This page is the answer to "what was I
 * doing?", regardless of which tool you were doing it in.
 */
export default function Projects() {
  const [entries, setEntries] = useState<ProjectEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmWipe, setConfirmWipe] = useState(false);
  // Probed on mount rather than at module load: a private window or a strict
  // privacy setting blocks storage, and this page would otherwise just look
  // permanently empty with no explanation.
  const [canStore, setCanStore] = useState(true);

  const refresh = useCallback(() => setEntries(listAllProjects()), []);

  useEffect(() => {
    document.title = "Your projects — Jima";
    setCanStore(storageAvailable());
    refresh();
  }, [refresh]);

  const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);
  const counts = {
    all: entries.length,
    captions: entries.filter((e) => e.kind === "captions").length,
    motion: entries.filter((e) => e.kind === "motion").length,
  };

  return (
    <div className="flex min-h-dvh flex-col bg-void">
      <SiteHeader />
      <main className="flex-1 pt-16">
        <Container className="py-14 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime">Your work</p>
              <h1 className="headline-xl mt-3 text-4xl text-chalk sm:text-5xl">Projects</h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ash">
                Everything you have open in both tools, newest first. It lives in this browser only — no account holds
                it, and nothing syncs to another device.
              </p>
            </div>

            {entries.length > 0 && (
              <div className="w-full max-w-[22rem] sm:w-auto">
                <Segmented
                  label="Filter projects"
                  hideLabel
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: `All ${counts.all}` },
                    { value: "captions", label: `Captions ${counts.captions}` },
                    { value: "motion", label: `Motion ${counts.motion}` },
                  ]}
                />
              </div>
            )}
          </div>

          {!canStore && (
            <div className="mt-8">
              <NoStorageNotice />
            </div>
          )}

          {entries.length === 0 ? (
            <div className="mt-12 rounded-bento border border-line bg-surface">
              <EmptyState
                icon={<FolderIcon width={30} height={30} />}
                title="Nothing here yet"
                body="Start something in either tool and it will show up here automatically — no saving required."
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    {PRODUCTS.map((p, i) => {
                      const Icon = p.icon;
                      return (
                        <Link key={p.id} to={p.path} className={buttonClasses(i === 0 ? "primary" : "secondary", "md")}>
                          <Icon width={16} height={16} />
                          {p.name}
                        </Link>
                      );
                    })}
                  </div>
                }
              />
            </div>
          ) : (
            <>
              <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((entry) => (
                  <ProjectCard
                    key={entry.key}
                    entry={entry}
                    onDeleted={() => {
                      void deleteProjectEntry(entry).then(refresh);
                    }}
                  />
                ))}
              </ul>

              {shown.length === 0 && (
                <p className="mt-10 rounded-card border border-line bg-surface px-5 py-8 text-center text-sm text-dim">
                  No {filter} projects yet.
                </p>
              )}

              <div className="mt-14 border-t border-line pt-8">
                {confirmWipe ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-card border border-error/30 bg-error-tint px-5 py-4">
                    <p className="flex-1 text-sm text-chalk">
                      Delete all {entries.length} projects? This cannot be undone — there is no copy anywhere else.
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmWipe(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        void deleteAllProjects().then(() => {
                          setConfirmWipe(false);
                          refresh();
                        });
                      }}
                    >
                      Delete everything
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-4">
                    <p className="text-xs text-dim">
                      Stored in this browser. Clearing your site data removes all of it.
                    </p>
                    <Button variant="ghost" size="sm" className="ml-auto text-dim" onClick={() => setConfirmWipe(true)}>
                      <TrashIcon width={15} height={15} />
                      Clear all projects
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}

function ProjectCard({ entry, onDeleted }: { entry: ProjectEntry; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const Icon = entry.kind === "captions" ? CaptionsIcon : MotionIcon;
  const def = entry.motion ? getTemplate(entry.motion.templateId) : undefined;

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-bento border border-line bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-lime/35 hover:shadow-pop">
      <Link to={entry.href} className="block" aria-label={`Open ${entry.title}`}>
        <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-shell">
          {def && entry.motion ? (
            <PosterThumb
              def={def}
              aspect={entry.motion.aspect}
              paletteId={entry.motion.paletteId}
              alt={`${entry.title} preview`}
              className="absolute inset-0 h-full w-full"
            />
          ) : entry.thumbnail ? (
            <img src={entry.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-dim">
              <Icon width={26} height={26} />
            </div>
          )}
          <span className="absolute left-2.5 top-2.5">
            <Badge tone="chalk">
              <Icon width={12} height={12} />
              {entry.kind === "captions" ? "Captions" : "Motion"}
            </Badge>
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link to={entry.href} className="min-w-0">
          <p className="truncate font-display text-[15px] font-semibold text-chalk" title={entry.title}>
            {entry.title}
          </p>
          <p className="mt-1 truncate text-xs text-dim">{entry.detail}</p>
        </Link>

        {entry.needsFile && (
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-dim">
            <UploadIcon width={12} height={12} className="mt-0.5 shrink-0" />
            Transcript and style saved — pick the video again to continue.
          </p>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
          <span className="text-[11px] text-dim">{relativeTime(entry.updatedAt)}</span>
          <Link
            to={entry.href}
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-lime hover:text-lime-bright"
          >
            Open
            <ArrowRightIcon width={13} height={13} />
          </Link>
          <button
            type="button"
            onClick={() => (confirm ? onDeleted() : setConfirm(true))}
            onBlur={() => setConfirm(false)}
            aria-label={confirm ? `Confirm delete ${entry.title}` : `Delete ${entry.title}`}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors",
              confirm ? "bg-error text-void" : "text-dim hover:bg-surface-2 hover:text-error",
            )}
          >
            <TrashIcon width={13} height={13} />
            {confirm && "Sure?"}
          </button>
        </div>
      </div>
    </li>
  );
}

/** Also used by the tools' own empty states. */
export function NoStorageNotice() {
  return (
    <Notice tone="warning" title="Storage is unavailable">
      This browser is blocking site storage (a private window, or a strict privacy setting). Jima still works, but
      nothing will be saved between visits.
    </Notice>
  );
}
