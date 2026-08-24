import type { Aspect, TemplateDefinition } from "@jima/engine";
import { useMotionStore, canUndo, canRedo } from "../state/store";
import { categoryLabel } from "../gallery/groups";
import { ToolBar } from "@/shell/ToolBar";
import { Badge, Button, IconButton, cn, ChevronLeftIcon, DownloadIcon, RedoIcon, UndoIcon } from "@/ui";

const ASPECT_LABEL: Record<Aspect, string> = {
  "1:1": "1:1",
  "4:5": "4:5",
  "9:16": "9:16",
  "16:9": "16:9",
};

/**
 * The Motion editor's chrome, built on the shared `ToolBar` so it is the exact
 * same bar as the one in Captions: same height, same switcher, same hairline.
 * Only the three slots differ.
 */
export function Topbar({
  def,
  onBack,
  onExport,
}: {
  def: TemplateDefinition;
  onBack: () => void;
  onExport: () => void;
}) {
  const aspect = useMotionStore((s) => s.aspect);
  const setAspect = useMotionStore((s) => s.setAspect);
  const undo = useMotionStore((s) => s.undo);
  const redo = useMotionStore((s) => s.redo);
  const undoable = useMotionStore(canUndo);
  const redoable = useMotionStore(canRedo);

  return (
    <ToolBar
      product="motion"
      lead={
        <>
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 items-center gap-1 rounded-[10px] px-2 text-[13px] font-semibold text-ash transition-colors hover:bg-surface-2 hover:text-chalk"
          >
            <ChevronLeftIcon width={15} height={15} />
            <span className="hidden sm:inline">Templates</span>
          </button>
          <span className="truncate font-display text-[14px] font-semibold text-chalk">{def.name}</span>
          <Badge tone="neutral" className="hidden shrink-0 md:inline-flex">
            {categoryLabel(def.category)}
          </Badge>
        </>
      }
      center={
        <div role="radiogroup" aria-label="Aspect ratio" className="flex gap-1 rounded-full bg-void p-1 ring-1 ring-inset ring-line">
          {def.aspects.map((a) => {
            const active = a === aspect;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAspect(a)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums transition-colors sm:px-3",
                  active ? "bg-lime text-void shadow-xs" : "text-ash hover:text-chalk",
                )}
              >
                {ASPECT_LABEL[a]}
              </button>
            );
          })}
        </div>
      }
      actions={
        <>
          <IconButton label="Undo (⌘Z)" size="sm" onClick={undo} disabled={!undoable}>
            <UndoIcon width={16} height={16} />
          </IconButton>
          <IconButton label="Redo (⌘⇧Z)" size="sm" onClick={redo} disabled={!redoable}>
            <RedoIcon width={16} height={16} />
          </IconButton>
          <Button variant="primary" size="sm" className="ml-1" onClick={onExport} title="Export (⌘E)">
            <DownloadIcon width={15} height={15} />
            Export
          </Button>
        </>
      }
    />
  );
}
