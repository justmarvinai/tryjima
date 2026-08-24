import { useState } from "react";
import { PageShell } from "@/shell/PageShell";
import { Badge, cn, Segmented } from "@/ui";
import { NEWS, SCOPE_LABEL, type NewsScope } from "@/content/whatsNew";

type Filter = "all" | NewsScope;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "jima", label: "Jima" },
  { value: "captions", label: "Captions" },
  { value: "motion", label: "Motion" },
];

const SCOPE_TONE: Record<NewsScope, "lime" | "violet" | "cyan"> = {
  jima: "lime",
  captions: "violet",
  motion: "cyan",
};

export default function WhatsNew() {
  const [filter, setFilter] = useState<Filter>("all");
  const entries = filter === "all" ? NEWS : NEWS.filter((n) => n.scope === filter);

  return (
    <PageShell
      eyebrow="Release notes"
      title="What's new"
      intro={
        <>
          Everything that shipped in Jima, newest first. Captions and Motion ran as separate products until v2.0
          merged them, so their histories are folded into one timeline here.
        </>
      }
      wide
    >
      <div className="max-w-xs">
        <Segmented label="Filter releases" hideLabel value={filter} options={FILTERS} onChange={setFilter} />
      </div>

      <ol className="mt-10 flex flex-col gap-4">
        {entries.map((entry) => (
          <li
            key={`${entry.scope}-${entry.version}`}
            className={cn(
              "rounded-bento border bg-surface p-6 sm:p-8",
              entry.current ? "border-lime/35 shadow-glow" : "border-line",
            )}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone={entry.current ? "solid" : SCOPE_TONE[entry.scope]}>{SCOPE_LABEL[entry.scope]}</Badge>
              <span className="font-mono text-[13px] font-medium tabular-nums text-chalk">v{entry.version}</span>
              <span className="text-[13px] text-dim">{entry.date}</span>
              {entry.current && (
                <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.16em] text-lime">Latest</span>
              )}
            </div>

            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-chalk">{entry.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ash">{entry.summary}</p>

            <ul className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5">
              {entry.highlights.map((h) => (
                <li key={h} className="relative pl-5 text-[14px] leading-relaxed text-silver">
                  <span aria-hidden className="absolute left-0 top-[0.62em] h-1.5 w-1.5 rounded-full bg-lime" />
                  {h}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
