import type { TemplateDefinition } from "@jima/engine";
import { PosterThumb } from "../components/PosterThumb";

export function TemplateRail({
  templates,
  currentId,
  onSelect,
}: {
  templates: TemplateDefinition[];
  currentId: string;
  onSelect: (def: TemplateDefinition) => void;
}) {
  return (
    <nav aria-label="Templates" className="hidden w-[84px] shrink-0 flex-col border-r border-line bg-shell lg:flex">
      <div className="sticky top-0 z-10 border-b border-line bg-shell/90 px-2 py-2.5 backdrop-blur">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-dim">Library</p>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto p-2">
        {templates.map((t) => {
          const active = t.id === currentId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              aria-current={active}
              title={t.name}
              className={`overflow-hidden rounded-xl border-2 transition-all ${
                active ? "border-lime shadow-glow" : "border-line opacity-75 hover:opacity-100 hover:border-line-2"
              }`}
            >
              <PosterThumb def={t} aspect={t.defaultAspect} paletteId={t.palettes[0]?.id} alt={t.name} className="w-full rounded-lg" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
