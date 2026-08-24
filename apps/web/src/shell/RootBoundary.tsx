import { Component, type ErrorInfo, type ReactNode } from "react";
import { buttonClasses, JimaMark } from "@/ui";

interface State {
  error: Error | null;
}

/**
 * Last-resort error boundary around the whole app.
 *
 * Jima has no server and no error reporting, so an unhandled render error would
 * otherwise leave a blank page and no way out. This catches it, says something
 * true and useful, and offers the two recoveries that actually work in a
 * client-side app: reload, or go back to a route that does not depend on the
 * broken state.
 *
 * Deliberately NOT wired to any reporting endpoint — sending stack traces
 * somewhere would break the promise on the tin.
 */
export class RootBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only — the user's own devtools, nowhere else.
    console.error("Jima crashed while rendering:", error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-dvh place-items-center bg-void px-6">
        <div className="w-full max-w-lg text-center">
          <JimaMark className="mx-auto h-9 w-9 text-lime" />
          <h1 className="headline-xl mt-6 text-3xl text-chalk sm:text-4xl">Something broke.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ash">
            Jima hit an error it could not recover from. Nothing left your device — there is no server to send it
            to — and your saved projects are untouched.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-card border border-line bg-surface px-4 py-3 text-left font-mono text-[11px] leading-relaxed text-dim">
            {error.message || String(error)}
          </pre>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className={buttonClasses("primary", "md")}>
              Reload
            </button>
            {/* A plain anchor, not a <Link>: this boundary sits OUTSIDE the
                router (so it also catches a router-level failure), where a
                <Link> would throw for want of context. A full document load is
                the right recovery after a crash anyway. */}
            <a href="/" className={buttonClasses("secondary", "md")}>
              Back to Jima
            </a>
          </div>
        </div>
      </div>
    );
  }
}
