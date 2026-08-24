import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  cn,
  Kbd,
  CaptionsIcon,
  MotionIcon,
  FolderIcon,
  PaletteIcon,
  SearchIcon,
  ShieldIcon,
  SparkleIcon,
  GridIcon,
} from "@/ui";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  to: string;
  keywords: string;
  group: "Tools" | "Go to" | "More";
}

const COMMANDS: Command[] = [
  {
    id: "captions",
    label: "Jima Captions",
    hint: "Caption a video",
    icon: <CaptionsIcon width={17} height={17} />,
    to: "/captions",
    keywords: "captions subtitles transcribe srt vtt whisper video",
    group: "Tools",
  },
  {
    id: "motion",
    label: "Jima Motion",
    hint: "Animate a template",
    icon: <MotionIcon width={17} height={17} />,
    to: "/motion",
    keywords: "motion animation template studio mp4 gif webm",
    group: "Tools",
  },
  {
    id: "projects",
    label: "Your projects",
    icon: <FolderIcon width={17} height={17} />,
    to: "/projects",
    keywords: "projects recent saved work resume library",
    group: "Go to",
  },
  {
    id: "brand",
    label: "Brand kit",
    icon: <PaletteIcon width={17} height={17} />,
    to: "/brand",
    keywords: "brand kit colors colours fonts palette identity",
    group: "Go to",
  },
  {
    id: "templates",
    label: "Browse templates",
    icon: <GridIcon width={17} height={17} />,
    to: "/motion",
    keywords: "templates gallery browse library animations",
    group: "Go to",
  },
  {
    id: "whats-new",
    label: "What's new",
    icon: <SparkleIcon width={17} height={17} />,
    to: "/whats-new",
    keywords: "changelog releases updates news version",
    group: "More",
  },
  {
    id: "help",
    label: "Help & troubleshooting",
    icon: <SearchIcon width={17} height={17} />,
    to: "/help",
    keywords: "help docs support browser export problem faq",
    group: "More",
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: <ShieldIcon width={17} height={17} />,
    to: "/privacy",
    keywords: "privacy data tracking legal policy",
    group: "More",
  },
];

/**
 * ⌘K / Ctrl-K palette, mounted app-wide.
 *
 * It exists mostly to serve the merge: with two tools plus projects and a brand
 * kit, "get me to the other thing" is now a frequent move, and a palette is a
 * lot faster than walking back out to a nav bar from inside a full-screen
 * editor.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => `${c.label} ${c.hint ?? ""} ${c.keywords}`.toLowerCase().includes(q));
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }, []);

  const run = useCallback(
    (cmd: Command | undefined) => {
      if (!cmd) return;
      close();
      navigate(cmd.to);
    },
    [close, navigate],
  );

  // Global open shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in range as the result set shrinks, and scrolled
  // into view as the user arrows past the fold.
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const groups = ["Tools", "Go to", "More"] as const;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-void/70 px-4 pt-[12vh] backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl overflow-hidden rounded-modal border border-line bg-surface shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon width={17} height={17} className="shrink-0 text-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => (i + 1) % Math.max(1, results.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => (i - 1 + results.length) % Math.max(1, results.length));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(results[index]);
              }
            }}
            placeholder="Search Jima…"
            aria-label="Search Jima"
            className="h-13 w-full bg-transparent text-[15px] text-chalk outline-none placeholder:text-dim"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-dim">No matches.</p>
          ) : (
            groups.map((group) => {
              const rows = results.filter((c) => c.group === group);
              if (rows.length === 0) return null;
              return (
                <div key={group} className="mb-1 last:mb-0">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-dim">{group}</p>
                  {rows.map((cmd) => {
                    const i = results.indexOf(cmd);
                    const active = i === index;
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        data-idx={i}
                        onMouseMove={() => setIndex(i)}
                        onClick={() => run(cmd)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors",
                          active ? "bg-surface-2" : "hover:bg-surface-2",
                        )}
                      >
                        <span className={cn("shrink-0", active ? "text-lime" : "text-dim")}>{cmd.icon}</span>
                        <span className="flex-1 truncate text-[14px] font-medium text-chalk">{cmd.label}</span>
                        {cmd.hint && <span className="shrink-0 text-xs text-dim">{cmd.hint}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-dim">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
