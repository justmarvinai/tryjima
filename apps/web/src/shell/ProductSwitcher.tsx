import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn, JimaMark, ChevronDownIcon, CheckIcon, FolderIcon, PaletteIcon } from "@/ui";
import { PRODUCTS, type ProductId } from "./products";
import { useDismiss } from "./useDismiss";

/**
 * The switcher that lives at the far left of every tool's chrome: the Jima mark
 * plus the current product, opening a menu of the others.
 *
 * This one control is what makes two tools read as one product. It is always in
 * the same place, always says which tool you are in, and is always one click
 * from the other — the Figma model, where "Figma Design" and "Figma Slides"
 * share a switcher rather than a bookmark bar.
 */
export function ProductSwitcher({ current }: { current: ProductId }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close);

  const active = PRODUCTS.find((p) => p.id === current);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex h-9 items-center gap-2 rounded-[10px] pl-2 pr-1.5 text-sm font-semibold transition-colors",
          open ? "bg-surface-2 text-chalk" : "text-chalk hover:bg-surface-2",
        )}
      >
        <JimaMark className="h-[18px] w-[18px] shrink-0 text-lime" />
        <span className="hidden font-display tracking-tight sm:inline">{active?.short ?? "Jima"}</span>
        <ChevronDownIcon width={14} height={14} className={cn("text-dim transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Switch product"
          className="absolute left-0 top-full z-50 mt-2 w-[19rem] overflow-hidden rounded-panel border border-line bg-surface p-1.5 shadow-pop"
        >
          <p className="px-2.5 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-dim">Tools</p>
          {PRODUCTS.map((p) => {
            const Icon = p.icon;
            const isCurrent = p.id === current;
            return (
              <Link
                key={p.id}
                to={p.path}
                role="menuitem"
                onClick={close}
                className={cn(
                  "flex items-start gap-3 rounded-[10px] px-2.5 py-2.5 transition-colors",
                  isCurrent ? "bg-surface-2" : "hover:bg-surface-2",
                )}
              >
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", p.chip)}>
                  <Icon width={17} height={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="font-display text-[13.5px] font-semibold text-chalk">{p.name}</span>
                    {isCurrent && <CheckIcon width={13} height={13} className="text-lime" />}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-dim">{p.tagline}</span>
                </span>
              </Link>
            );
          })}

          <div className="my-1.5 h-px bg-line" />

          <MenuLink to="/projects" onClick={close} icon={<FolderIcon width={16} height={16} />}>
            Your projects
          </MenuLink>
          <MenuLink to="/brand" onClick={close} icon={<PaletteIcon width={16} height={16} />}>
            Brand kit
          </MenuLink>
          <MenuLink to="/" onClick={close} icon={<JimaMark className="h-4 w-4" />}>
            Jima home
          </MenuLink>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  to,
  onClick,
  icon,
  children,
}: {
  to: string;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-silver transition-colors hover:bg-surface-2 hover:text-chalk"
    >
      <span className="flex w-4 justify-center text-dim">{icon}</span>
      {children}
    </Link>
  );
}
