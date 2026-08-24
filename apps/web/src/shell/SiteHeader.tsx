import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn, Wordmark, buttonClasses, ChevronDownIcon, CloseIcon, MenuIcon, ArrowRightIcon } from "@/ui";
import { PRODUCTS } from "./products";
import { useDismiss } from "./useDismiss";

const NAV = [
  { to: "/projects", label: "Projects" },
  { to: "/whats-new", label: "What's new" },
  { to: "/help", label: "Help" },
];

/**
 * The marketing header — landing and content pages only; the tools use
 * `ToolBar`. Transparent over the hero, then solidifies with a hairline once
 * the page scrolls, so the hero art is never boxed in by a bar.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Any navigation closes the mobile sheet.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  // The sheet is a full-screen overlay; lock the page behind it.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled ? "border-b border-line bg-void/85 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5 sm:px-6">
        <Link to="/" aria-label="Jima home" className="shrink-0 rounded-lg">
          <Wordmark className="text-[22px]" />
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-0.5 md:flex">
          <ToolsMenu />
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "text-chalk" : "text-ash hover:text-chalk",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* The responsive `hidden` lives on a WRAPPER, not on the link.
              `buttonClasses` already sets `inline-flex`, and Tailwind emits
              `.inline-flex` after `.hidden`, so a `hidden` alongside it never
              wins — the header's CTAs stayed on at 390px and collided with the
              hamburger. */}
          <span className="hidden lg:block">
            <Link to="/captions" className={buttonClasses("ghost", "sm")}>
              Open Captions
            </Link>
          </span>
          <span className="hidden sm:block">
            <Link to="/motion" className={buttonClasses("primary", "sm")}>
              Open Motion
            </Link>
          </span>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-chalk transition-colors hover:bg-surface-2 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {mobileOpen && <MobileSheet onClose={() => setMobileOpen(false)} />}
    </header>
  );
}

function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative" onMouseLeave={close}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          open ? "text-chalk" : "text-ash hover:text-chalk",
        )}
      >
        Tools
        <ChevronDownIcon width={14} height={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 w-[26rem] pt-2">
          <div className="overflow-hidden rounded-panel border border-line bg-surface p-2 shadow-pop">
            {PRODUCTS.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.id}
                  to={p.path}
                  onClick={close}
                  className="group/tool flex items-start gap-3.5 rounded-[12px] p-3 transition-colors hover:bg-surface-2"
                >
                  <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", p.chip)}>
                    <Icon width={18} height={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-display text-[15px] font-semibold text-chalk">
                      {p.name}
                      <ArrowRightIcon
                        width={14}
                        height={14}
                        className="-translate-x-1 text-lime opacity-0 transition-all group-hover/tool:translate-x-0 group-hover/tool:opacity-100"
                      />
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-dim">{p.tagline}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-x-0 top-16 bottom-0 z-50 overflow-y-auto border-t border-line bg-void px-5 pb-10 pt-4 md:hidden">
      <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-dim">Tools</p>
      <div className="flex flex-col gap-2">
        {PRODUCTS.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.id}
              to={p.path}
              onClick={onClose}
              className="flex items-start gap-3.5 rounded-card border border-line bg-surface p-4"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]", p.chip)}>
                <Icon />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold text-chalk">{p.name}</span>
                <span className="mt-1 block text-sm leading-snug text-dim">{p.tagline}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClose}
            className="rounded-lg px-1 py-3 text-base font-medium text-silver"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
