import { useEffect, useRef, useState } from "react";
import {
  createFontRegistry,
  exportTemplate,
  type Capabilities,
  type ExportFormat,
  type ExportProfile,
  type ExportProgress,
  type ExportResult,
  type TemplateDefinition,
} from "@jima/engine";
import { useMotionStore } from "../state/store";
import { engineValues } from "../state/values";
import { Button, Switch, cn } from "../../ui";

type Phase = "configure" | "rendering" | "done" | "error";

const RES = { "1080": 1, "720": 720 / 1080, "480": 480 / 1080 } as const;

// Mirrors the <Button variant="primary" size="md"> look for the one spot that must
// stay a real <a download> (native download semantics) instead of the <button>-only primitive.
const downloadLinkCls =
  "inline-flex h-11 select-none items-center justify-center gap-2 rounded-xl bg-lime px-5 text-[15px] font-bold text-void shadow-xs transition-colors duration-150 hover:bg-lime-bright active:bg-lime-deep";

export function ExportModal({
  def,
  caps,
  onClose,
}: {
  def: TemplateDefinition;
  caps: Capabilities | null;
  onClose: () => void;
}) {
  const aspect = useMotionStore((s) => s.aspect);
  const values = useMotionStore((s) => s.values);
  const paletteId = useMotionStore((s) => s.paletteId);
  const font = useMotionStore((s) => s.font);
  const bodyFont = useMotionStore((s) => s.bodyFont);
  const speed = useMotionStore((s) => s.speed);
  const energy = useMotionStore((s) => s.energy);
  const trim = useMotionStore((s) => s.trim);
  const hold = useMotionStore((s) => s.hold);
  const sound = useMotionStore((s) => s.sound);
  const music = useMotionStore((s) => s.music);
  const soundPack = useMotionStore((s) => s.soundPack);

  const [phase, setPhase] = useState<Phase>("configure");
  const [format, setFormat] = useState<ExportFormat>("webm");
  const [transparent, setTransparent] = useState(false);
  const [motionBlur, setMotionBlur] = useState(false);
  const [videoQuality, setVideoQuality] = useState<"1080" | "720">("1080");
  const [fps, setFps] = useState(30);
  const [gifSize, setGifSize] = useState<"480" | "720">("480");
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const userPickedFormat = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog and hand it back on close. `role="dialog"` and
  // `aria-modal` were already here, but focus stayed on the Export button
  // behind the scrim — so a keyboard user opened the modal and then tabbed
  // through the editor underneath it.
  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
    );
    (first ?? panelRef.current)?.focus();

    // Keep Tab inside the panel while it is open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
      );
      if (!items || items.length === 0) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === firstItem || !panelRef.current?.contains(active))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      restoreTo?.focus?.();
    };
  }, []);

  // Default to the best available format once caps are known — but never
  // overwrite a choice the user already made (detection can resolve slowly).
  useEffect(() => {
    if (!caps || userPickedFormat.current) return;
    setFormat(caps.mp4 === "native" ? "mp4" : "webm");
  }, [caps]);

  useEffect(() => {
    return () => {
      // Closing the modal mid-render (e.g. via Escape) must abort the export —
      // otherwise it runs to completion, downloads a file the user cancelled,
      // and leaks the result blob URL.
      abortRef.current?.abort();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  const available: Record<ExportFormat, boolean> = {
    mp4: caps ? caps.mp4 === "native" : false,
    webm: caps ? caps.webm === "native" : true,
    gif: true,
  };

  // Transparency needs an alpha-capable codec — only WebM/VP9 qualifies here.
  // Picking MP4/GIF clears it; enabling it snaps the format to WebM.
  function chooseFormat(f: ExportFormat) {
    userPickedFormat.current = true;
    setFormat(f);
    if (f !== "webm") setTransparent(false);
  }
  function toggleTransparent(on: boolean) {
    userPickedFormat.current = true;
    setTransparent(on);
    if (on) setFormat("webm");
  }

  async function run() {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("rendering");
    setProgress(null);
    const profile: ExportProfile =
      format === "gif"
        ? { format: "gif", fps: 12, resolution: RES[gifSize], gifMaxColors: 128 }
        : { format, fps, resolution: RES[videoQuality] };
    try {
      const res = await exportTemplate({
        def,
        runner: { aspect, values: engineValues(def, values), ...(paletteId ? { paletteId } : {}), fonts: createFontRegistry({ headline: font, body: bodyFont }), energy, trim, hold },
        profile,
        speed,
        sound,
        soundPack,
        music,
        transparent: transparent && format === "webm",
        motionBlur,
        signal: controller.signal,
        onProgress: setProgress,
      });
      const url = URL.createObjectURL(res.blob);
      // Revoke the previous export's URL before replacing it; otherwise each
      // repeated "Export another" leaks its prior blob until the modal unmounts.
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = url;
      setResult(res);
      setPhase("done");
      triggerDownload(url, res.filename);
    } catch (err) {
      if (err instanceof Error && err.name === "ExportCancelledError") {
        setPhase("configure");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="motion-export-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "rendering") onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-lg overflow-hidden rounded-bento bg-paper shadow-bold focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-mist px-6 py-4">
          <h2 id="motion-export-title" className="font-display text-2xl font-extrabold text-ink headline-xl">
            Export
          </h2>
          {phase !== "rendering" && (
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              ✕
            </Button>
          )}
        </div>

        <div className="px-6 py-6">
          {phase === "configure" && (
            <Configure
              format={format}
              setFormat={chooseFormat}
              available={available}
              caps={caps}
              videoQuality={videoQuality}
              setVideoQuality={setVideoQuality}
              fps={fps}
              setFps={setFps}
              gifSize={gifSize}
              setGifSize={setGifSize}
              aspect={aspect}
              sound={sound}
              transparent={transparent}
              onTransparentChange={toggleTransparent}
              motionBlur={motionBlur}
              onMotionBlurChange={setMotionBlur}
              onExport={run}
            />
          )}
          {phase === "rendering" && <Rendering progress={progress} onCancel={() => abortRef.current?.abort()} />}
          {phase === "done" && result && (
            <Done result={result} url={resultUrlRef.current} transparent={transparent && result.format === "webm"} onAnother={() => setPhase("configure")} onClose={onClose} />
          )}
          {phase === "error" && (
            <ErrorState message={error} onRetry={() => setPhase("configure")} onGif={() => { chooseFormat("gif"); setPhase("configure"); }} />
          )}
        </div>
      </div>
    </div>
  );
}

const FORMAT_META: Record<ExportFormat, { title: string; sub: string }> = {
  mp4: { title: "MP4", sub: "Best for Instagram & TikTok" },
  webm: { title: "WebM", sub: "Smallest video, plays everywhere modern" },
  gif: { title: "GIF", sub: "Loops anywhere · ≤ 10s" },
};

function Configure(props: {
  format: ExportFormat;
  setFormat: (f: ExportFormat) => void;
  available: Record<ExportFormat, boolean>;
  caps: Capabilities | null;
  videoQuality: "1080" | "720";
  setVideoQuality: (q: "1080" | "720") => void;
  fps: number;
  setFps: (n: number) => void;
  gifSize: "480" | "720";
  setGifSize: (s: "480" | "720") => void;
  aspect: string;
  sound: boolean;
  transparent: boolean;
  onTransparentChange: (on: boolean) => void;
  motionBlur: boolean;
  onMotionBlurChange: (on: boolean) => void;
  onExport: () => void;
}) {
  const { format, setFormat, available, caps, sound, transparent, onTransparentChange, motionBlur, onMotionBlurChange } = props;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2">
        {(["mp4", "webm", "gif"] as ExportFormat[]).map((f) => {
          const enabled = available[f];
          const active = format === f;
          return (
            <button
              key={f}
              type="button"
              disabled={!enabled}
              onClick={() => setFormat(f)}
              aria-pressed={active}
              className={cn(
                "flex flex-col gap-1 rounded-xl border-2 p-3 text-left transition-colors",
                active ? "border-primary-strong bg-emerald-tint" : "border-mist hover:border-slate",
                !enabled && "cursor-not-allowed opacity-45",
              )}
            >
              <span className="font-display text-base font-bold text-ink">{FORMAT_META[f].title}</span>
              <span className="text-xs leading-snug text-slate">
                {enabled ? FORMAT_META[f].sub : f === "mp4" ? "Not available in this browser — use WebM or GIF" : "Unavailable"}
              </span>
            </button>
          );
        })}
      </div>

      {format === "gif" ? (
        <Segment label="Size" value={props.gifSize} options={[["480", "480p"], ["720", "720p"]]} onChange={(v) => props.setGifSize(v as "480" | "720")} />
      ) : (
        <>
          <Segment label="Resolution" value={props.videoQuality} options={[["1080", "1080p"], ["720", "720p"]]} onChange={(v) => props.setVideoQuality(v as "1080" | "720")} />
          <Segment label="Frame rate" value={String(props.fps)} options={[["30", "30 fps"], ["60", "60 fps"]]} onChange={(v) => props.setFps(Number(v))} />
        </>
      )}

      <div>
        <label className="flex items-center justify-between">
          <span className="text-sm font-semibold text-graphite">Motion blur</span>
          <Switch checked={motionBlur} onChange={onMotionBlurChange} label="Motion blur" />
        </label>
        <p className="mt-1.5 text-xs text-slate">
          {motionBlur
            ? "Each frame is averaged across a 180° shutter — fast moves smear instead of strobing. Slower to export."
            : "Off = one crisp pose per frame. Turn on for fast slides, spins and whip pans."}
        </p>
      </div>

      <div>
        <label className="flex items-center justify-between">
          <span className="text-sm font-semibold text-graphite">Transparent background</span>
          <Switch checked={transparent} onChange={onTransparentChange} label="Transparent background" />
        </label>
        <p className="mt-1.5 text-xs text-slate">
          {transparent
            ? "Exports a WebM with an alpha channel — drop it over any footage. Works in After Effects, DaVinci Resolve, CapCut & the web. Premiere Pro may show it opaque."
            : "Off = solid background. Turn on to export the animation with no background (WebM only)."}
        </p>
      </div>

      <p className="text-xs text-slate">
        {props.aspect} · everything renders on your device — nothing is uploaded.
        {caps === null ? " Checking formats…" : ""}
      </p>

      {sound && (
        <p className="rounded-xl bg-subtle px-3 py-2 text-xs text-slate">
          {format === "gif"
            ? "🔇 GIF has no audio — export MP4 or WebM to include the sound."
            : "🔊 Sound is on — the matched sound effects are baked into the file."}
        </p>
      )}

      <Button size="lg" className="w-full" onClick={props.onExport}>
        Export {FORMAT_META[format].title}
      </Button>
    </div>
  );
}

function Segment({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-graphite">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-subtle p-1">
        {options.map(([val, lbl]) => {
          const active = val === value;
          return (
            <button
              key={val}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(val)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                active ? "bg-lime text-void shadow-xs" : "text-slate hover:text-ink",
              )}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Rendering({ progress, onCancel }: { progress: ExportProgress | null; onCancel: () => void }) {
  const ratio = progress?.ratio ?? 0;
  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-ink">Rendering…</span>
        <span aria-live="polite" className="tabular-nums text-slate">
          {progress ? `${progress.frame} / ${progress.totalFrames} frames` : "starting…"}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-mist">
        <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <Button variant="ghost" size="sm" className="self-start" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function Done({ result, url, transparent, onAnother, onClose }: { result: ExportResult; url: string | null; transparent: boolean; onAnother: () => void; onClose: () => void }) {
  // A checkerboard behind a transparent export makes its alpha visible.
  const checker = transparent
    ? {
        backgroundImage:
          "linear-gradient(45deg,#c8c8d0 25%,transparent 25%),linear-gradient(-45deg,#c8c8d0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#c8c8d0 75%),linear-gradient(-45deg,transparent 75%,#c8c8d0 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
        backgroundColor: "#ffffff",
      }
    : undefined;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center overflow-hidden rounded-xl bg-subtle p-3" style={checker}>
        {url && (result.format === "gif" ? (
          <img src={url} alt="Export preview" className="max-h-64 rounded-lg" />
        ) : (
          <video src={url} className="max-h-64 rounded-lg" autoPlay loop muted playsInline />
        ))}
      </div>
      <p className="text-sm text-slate">
        Saved <span className="font-semibold text-ink">{result.filename}</span> — {result.width}×{result.height}, {result.frames} frames.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {url && (
          <a href={url} download={result.filename} className={downloadLinkCls}>
            Download again
          </a>
        )}
        <Button variant="secondary" onClick={onAnother}>
          Export another
        </Button>
        <Button variant="ghost" className="ml-auto" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry, onGif }: { message: string; onRetry: () => void; onGif: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink">That export hit a snag on this device. Your work is safe.</p>
      <p className="rounded-xl bg-subtle px-3 py-2 text-xs text-slate">{message}</p>
      <div className="flex gap-2">
        <Button onClick={onGif}>Try GIF instead</Button>
        <Button variant="secondary" onClick={onRetry}>
          Back
        </Button>
      </div>
    </div>
  );
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
