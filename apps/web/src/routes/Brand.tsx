import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BODY_FONT_CHOICES, FONT_CHOICES, THEME_KEYS, THEME_PRESETS, type Values } from "@jima/engine";
import { getTemplate } from "@jima/templates";
import { captionFontForMotionId, drawCaptions, loadFont, DEFAULT_CAPTION_STYLE, type Cue } from "@jima/captions";
import { PosterThumb } from "@/motion/components/PosterThumb";
import { SiteHeader } from "@/shell/SiteHeader";
import { SiteFooter } from "@/shell/SiteFooter";
import { getBrandKit, useBrandKit, writeBrandKit, type BrandKit } from "@/brand/kit";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  cn,
  ColorField,
  Container,
  Notice,
  Select,
  CheckIcon,
  PaletteIcon,
  TrashIcon,
} from "@/ui";

/** The template the Motion preview uses — one that exposes all three theme keys. */
const PREVIEW_TEMPLATE = "quote-spotlight";

interface Draft {
  background: string;
  textColor: string;
  accent: string;
  font: string;
  bodyFont: string;
}

const FALLBACK: Draft = {
  background: "#0F1115",
  textColor: "#FFFFFF",
  accent: "#C8FF3D",
  font: "default",
  bodyFont: "default",
};

function toDraft(kit: BrandKit | null): Draft {
  return {
    background: kit?.background ?? FALLBACK.background,
    textColor: kit?.textColor ?? FALLBACK.textColor,
    accent: kit?.accent ?? FALLBACK.accent,
    font: kit?.font ?? FALLBACK.font,
    bodyFont: kit?.bodyFont ?? FALLBACK.bodyFont,
  };
}

/**
 * The brand kit editor.
 *
 * The two previews are the point of the page: the same five values, shown at
 * the same moment on a Motion template and on a caption, rendered by the real
 * engines rather than mocked up. If a colour pair works in one and dies in the
 * other, you see it here rather than two exports later.
 */
export default function Brand() {
  const saved = useBrandKit();
  const [draft, setDraft] = useState<Draft>(() => toDraft(getBrandKit()));
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    document.title = "Brand kit — Jima";
  }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setJustSaved(false);
  };

  const dirty = useMemo(() => JSON.stringify(toDraft(saved)) !== JSON.stringify(draft), [saved, draft]);

  const previewValues: Values = useMemo(
    () => ({
      [THEME_KEYS.background]: draft.background,
      [THEME_KEYS.text]: draft.textColor,
      [THEME_KEYS.accent]: draft.accent,
    }),
    [draft.background, draft.textColor, draft.accent],
  );

  const def = getTemplate(PREVIEW_TEMPLATE);

  return (
    <div className="flex min-h-dvh flex-col bg-void">
      <SiteHeader />
      <main className="flex-1 pt-16">
        <Container className="py-14 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime">Shared across both tools</p>
            <h1 className="headline-xl mt-3 text-4xl text-chalk sm:text-5xl">Brand kit</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ash">
              Three colours and two typefaces. Save them once and they are a click away in every Motion template and
              every caption style — which is the whole reason the two tools carry the same font roster.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-12">
            {/* ---- Editor ---- */}
            <div className="flex flex-col gap-6">
              <Card className="p-6">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold text-chalk">
                  <PaletteIcon width={17} height={17} className="text-lime" />
                  Colours
                </h2>
                <div className="mt-5 flex flex-col gap-5">
                  <ColorField label="Background" value={draft.background} onChange={(v) => set("background", v)} />
                  <ColorField label="Text" value={draft.textColor} onChange={(v) => set("textColor", v)} />
                  <ColorField label="Accent" value={draft.accent} onChange={(v) => set("accent", v)} />
                </div>

                <div className="mt-6 border-t border-line pt-5">
                  <p className="text-[13px] font-medium text-silver">Start from a preset</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {THEME_PRESETS.slice(0, 12).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.name}
                        aria-label={`Use the ${preset.name} preset`}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            background: preset.background,
                            textColor: preset.text,
                            accent: preset.accent,
                          }))
                        }
                        className="flex h-9 w-9 overflow-hidden rounded-lg ring-1 ring-inset ring-line-2 transition-transform hover:scale-110"
                      >
                        <span className="h-full flex-1" style={{ background: preset.background }} />
                        <span className="h-full flex-1" style={{ background: preset.accent }} />
                        <span className="h-full flex-1" style={{ background: preset.text }} />
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-display text-base font-semibold text-chalk">Typefaces</h2>
                <div className="mt-5 flex flex-col gap-5">
                  <Select
                    label="Headline"
                    value={draft.font}
                    onChange={(v) => set("font", v)}
                    options={FONT_CHOICES.map((f) => ({ value: f.id, label: f.label }))}
                  />
                  <Select
                    label="Body"
                    value={draft.bodyFont}
                    onChange={(v) => set("bodyFont", v)}
                    options={BODY_FONT_CHOICES.map((f) => ({ value: f.id, label: f.label }))}
                  />
                </div>
                <CaptionFontNote motionId={draft.font} />
              </Card>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    writeBrandKit({
                      background: draft.background,
                      textColor: draft.textColor,
                      accent: draft.accent,
                      font: draft.font,
                      bodyFont: draft.bodyFont,
                    });
                    setJustSaved(true);
                  }}
                  disabled={!dirty}
                >
                  {justSaved && !dirty ? (
                    <>
                      <CheckIcon width={16} height={16} />
                      Saved
                    </>
                  ) : saved ? (
                    "Update kit"
                  ) : (
                    "Save kit"
                  )}
                </Button>
                {saved && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      writeBrandKit(null);
                      setDraft(toDraft(null));
                      setJustSaved(false);
                    }}
                  >
                    <TrashIcon width={15} height={15} />
                    Clear
                  </Button>
                )}
                {saved && !dirty && (
                  <Badge tone="success">
                    <CheckIcon width={12} height={12} />
                    Active in both tools
                  </Badge>
                )}
              </div>

              <Notice tone="info">
                Stored in this browser's localStorage, like everything else Jima remembers. It never leaves your
                device and there is no account it could sync to.
              </Notice>
            </div>

            {/* ---- Live previews ---- */}
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-display text-lg font-semibold text-chalk">Live preview</h2>
                <p className="mt-1.5 text-sm text-dim">
                  The same kit, rendered by both engines. Nothing here is a mock-up.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <figure className="overflow-hidden rounded-bento border border-line bg-surface">
                  <div className="border-b border-line bg-shell px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-dim">Jima Motion</p>
                  </div>
                  {def ? (
                    <PosterThumb def={def} aspect="4:5" values={previewValues} alt="Template preview with your brand colours" />
                  ) : (
                    <div className="aspect-[4/5] bg-shell" />
                  )}
                  <figcaption className="px-4 py-3 text-xs text-dim">
                    {def?.name ?? "Template"} · applied to background, text and accent
                  </figcaption>
                </figure>

                <figure className="overflow-hidden rounded-bento border border-line bg-surface">
                  <div className="border-b border-line bg-shell px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-dim">Jima Captions</p>
                  </div>
                  <CaptionPreview draft={draft} />
                  <figcaption className="px-4 py-3 text-xs text-dim">
                    Real caption renderer · text and highlight from your kit
                  </figcaption>
                </figure>
              </div>

              <div className="rounded-bento border border-line bg-surface p-6">
                <h3 className="font-display text-[15px] font-semibold text-chalk">Where it applies</h3>
                <ul className="mt-4 flex flex-col gap-3 text-[14px] text-ash">
                  <li className="flex gap-2.5">
                    <CheckIcon width={15} height={15} className="mt-0.5 shrink-0 text-lime" />
                    <span>
                      In <strong className="font-semibold text-chalk">Motion</strong>, the inspector's "Apply brand kit"
                      button fills whichever of background, text and accent that template exposes, and switches both
                      fonts.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <CheckIcon width={15} height={15} className="mt-0.5 shrink-0 text-lime" />
                    <span>
                      In <strong className="font-semibold text-chalk">Captions</strong>, it sets the caption text
                      colour, the karaoke highlight, the background pill, and the typeface where a matching caption
                      weight exists.
                    </span>
                  </li>
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/motion" className={buttonClasses("secondary", "sm")}>
                    Open Motion
                  </Link>
                  <Link to="/captions" className={buttonClasses("secondary", "sm")}>
                    Open Captions
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Says plainly whether the chosen headline font also exists as a caption face. */
function CaptionFontNote({ motionId }: { motionId: string }) {
  const match = captionFontForMotionId(motionId);
  const label = FONT_CHOICES.find((f) => f.id === motionId)?.label ?? motionId;
  return (
    <p className="mt-4 flex items-start gap-2 border-t border-line pt-4 text-xs leading-relaxed text-dim">
      <CheckIcon width={13} height={13} className={cn("mt-0.5 shrink-0", match ? "text-lime" : "text-dim")} />
      {match ? (
        <>
          Captions renders this as <span className="text-silver">{match.label}</span>, so headlines and captions match.
        </>
      ) : (
        <>
          Captions has no {label} face at caption weight, so it will keep whichever typeface your caption style
          already uses.
        </>
      )}
    </p>
  );
}

/* ---- The captions preview, drawn with the real renderer ---------------- */

const PREVIEW_CUE: Cue[] = [
  {
    id: "preview",
    start: 0,
    end: 3,
    words: [
      { text: "YOUR", start: 0, end: 0.6 },
      { text: "BRAND", start: 0.6, end: 1.4 },
      { text: "EVERY", start: 1.4, end: 2.1 },
      { text: "POST", start: 2.1, end: 3 },
    ],
  },
];

const W = 540;
const H = 675; // 4:5, matching the Motion preview beside it

function CaptionPreview({ draft }: { draft: Draft }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const style = useMemo(() => {
    const font = captionFontForMotionId(draft.font);
    return {
      ...DEFAULT_CAPTION_STYLE,
      ...(font ? { fontFamily: font.key } : {}),
      textColor: draft.textColor,
      highlightEnabled: true,
      highlightColor: draft.accent,
      backgroundEnabled: false,
      fontSizePct: 7,
      positionYPct: 62,
    };
  }, [draft.font, draft.textColor, draft.accent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = draft.background;
      ctx.fillRect(0, 0, W, H);
      // Hold on the second word so the highlight is always visible.
      drawCaptions(ctx, 1.0, { cues: PREVIEW_CUE, style, videoWidth: W, videoHeight: H }, { clear: false });
    };

    // The caption face is loaded on demand through the FontFace loader, so it
    // may not be resident yet. Draw once immediately (the panel is never blank),
    // then redraw when the face lands — canvas silently falls back to a serif
    // otherwise. Only the one face the style actually uses is fetched.
    draw();
    void loadFont(style.fontFamily)
      .then(() => document.fonts.ready)
      .then(draw)
      .catch(draw);

    return () => {
      cancelled = true;
    };
  }, [style, draft.background]);

  return (
    <div className="aspect-[4/5] w-full bg-shell">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="h-full w-full"
        role="img"
        aria-label="Caption preview using your brand colours"
      />
    </div>
  );
}
