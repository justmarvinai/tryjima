import { Link } from "react-router-dom";
import { Container, Wordmark, ShieldIcon } from "@/ui";
import { PRODUCTS } from "./products";

const LEGAL = [
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/whats-new", label: "What's new" },
  { to: "/help", label: "Help" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-void">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link to="/" aria-label="Jima home" className="inline-block rounded-lg">
              <Wordmark className="text-2xl" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-dim">
              Two tools for short-form video, free and without an account. Everything runs in your browser — your
              footage never reaches a server, because there is no server.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-ash ring-1 ring-inset ring-line">
              <ShieldIcon width={14} height={14} className="text-lime" />
              100% on-device
            </p>
          </div>

          <nav aria-label="Tools">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-dim">Tools</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {PRODUCTS.map((p) => (
                <li key={p.id}>
                  <Link to={p.path} className="text-sm text-silver transition-colors hover:text-lime">
                    {p.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/projects" className="text-sm text-silver transition-colors hover:text-lime">
                  Your projects
                </Link>
              </li>
              <li>
                <Link to="/brand" className="text-sm text-silver transition-colors hover:text-lime">
                  Brand kit
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="More">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-dim">More</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {LEGAL.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-silver transition-colors hover:text-lime">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-dim">© {new Date().getFullYear()} Jima. Free, forever, no account.</p>
          <p className="text-xs text-dim">
            Built with open-source type and codecs. No trackers, no analytics, no uploads.
          </p>
        </div>
      </Container>
    </footer>
  );
}
