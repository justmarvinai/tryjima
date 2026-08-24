import type { ReactNode } from "react";
import { cn } from "@/ui";
import { ProductSwitcher } from "./ProductSwitcher";
import type { ProductId } from "./products";

/**
 * The chrome bar shared by both tools.
 *
 * Identical geometry in Captions and Motion — 52px tall, hairline underneath,
 * switcher hard left, actions hard right — so moving between the two feels like
 * changing modes inside one app rather than opening a different website. Each
 * tool fills the three slots with its own controls.
 */
export function ToolBar({
  product,
  lead,
  center,
  actions,
  className,
}: {
  product: ProductId;
  /** Tool-specific content immediately after the switcher (file name, template). */
  lead?: ReactNode;
  /** Centre slot — aspect switch, transport, etc. Hidden below `sm`. */
  center?: ReactNode;
  /** Right slot — undo/redo, export. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-13 shrink-0 items-center gap-2 border-b border-line bg-shell px-2.5 sm:px-3",
        className,
      )}
    >
      <ProductSwitcher current={product} />
      {lead && (
        <>
          <span aria-hidden className="hidden h-5 w-px shrink-0 bg-line sm:block" />
          <div className="flex min-w-0 items-center gap-2">{lead}</div>
        </>
      )}
      {center && <div className="ml-auto hidden sm:flex sm:items-center">{center}</div>}
      <div className={cn("flex items-center gap-1.5", center ? "ml-2 sm:ml-3" : "ml-auto")}>{actions}</div>
    </header>
  );
}

/** A quiet monospace chip for the current file/template name in the lead slot. */
export function ToolBarChip({ children, title }: { children: ReactNode; title?: string | undefined }) {
  return (
    <span
      title={title}
      className="hidden max-w-[30vw] truncate rounded-full bg-surface-2 px-3 py-1 font-mono text-[11.5px] text-ash ring-1 ring-inset ring-line sm:inline-block"
    >
      {children}
    </span>
  );
}
