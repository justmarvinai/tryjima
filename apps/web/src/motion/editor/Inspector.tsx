import { useState } from "react";
import {
  BODY_FONT_CHOICES,
  FONT_CHOICES,
  SOUND_PACKS,
  THEME_KEYS,
  profileForTemplate,
  THEME_PRESETS,
  contrastRatio,
  type TemplateDefinition,
  type TemplateField,
} from "@jima/engine";
import { useMotionStore } from "../state/store";
import { Field } from "../components/Field";
import { categoryLabel } from "../gallery/groups";
import { Badge, Button, Switch, cn } from "../../ui";

type Tab = "content" | "style" | "motion";

const CONTENT_TYPES = new Set(["text", "textarea", "textlist", "image"]);
const MOTION_TYPES = new Set(["select", "slider", "toggle"]);

/**
 * Plain-language names for the sound profiles. The profile is picked from the
 * template, not by the user — this just tells them what they are hearing.
 */
const PROFILE_LABEL: Record<string, string> = {
  ui: "app-UI sounds",
  type: "typographic ticks",
  impact: "punchy product hits",
  data: "mallet steps",
  airy: "glassy, open tones",
  warm: "soft, rounded tones",
  cinematic: "cinematic swells",
};

/** Small uppercase group label used to break the inspector into labeled sections. */
const groupLabelCls = "text-[11px] font-bold uppercase tracking-[0.1em] text-graphite";

export function Inspector({ def, baseDuration }: { def: TemplateDefinition; baseDuration: number }) {
  const [tab, setTab] = useState<Tab>("content");
  const values = useMotionStore((s) => s.values);
  const setValue = useMotionStore((s) => s.setValue);
  const reset = useMotionStore((s) => s.reset);

  const content = def.fields.filter((f) => CONTENT_TYPES.has(f.type));
  const colors = def.fields.filter((f) => f.type === "color");
  const motion = def.fields.filter((f) => MOTION_TYPES.has(f.type));

  return (
    <div className="flex h-full flex-col bg-paper">
      <div className="px-4 pb-3 pt-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Editing</p>
        <div className="mt-1 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-ink">{def.name}</h2>
          <Badge tone="emerald" className="shrink-0 px-2 py-0.5 text-[11px]">
            {categoryLabel(def.category)}
          </Badge>
        </div>
      </div>

      <div role="tablist" aria-label="Editor panels" className="flex gap-1 border-b border-mist px-4">
        <TabButton id="content" active={tab} onSelect={setTab} label="Content" />
        <TabButton id="style" active={tab} onSelect={setTab} label="Style" />
        <TabButton id="motion" active={tab} onSelect={setTab} label="Motion" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {tab === "content" && (
          <FieldGroup fields={content} values={values} onChange={setValue} def={def} emptyHint="This template has no text fields." />
        )}
        {tab === "style" && <StyleTab def={def} colors={colors} values={values} onChange={setValue} />}
        {tab === "motion" && <MotionTab def={def} motionFields={motion} values={values} onChange={setValue} baseDuration={baseDuration} />}
      </div>

      <div className="border-t border-mist px-4 py-3">
        <Button variant="ghost" size="sm" onClick={reset}>
          ↺ Reset template
        </Button>
      </div>
    </div>
  );
}

function TabButton({ id, active, onSelect, label }: { id: Tab; active: Tab; onSelect: (t: Tab) => void; label: string }) {
  const isActive = active === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect(id)}
      className={cn(
        "rounded-t-lg border-b-2 px-3 py-2.5 text-[15px] font-bold transition-colors",
        isActive ? "border-primary-strong text-ink" : "border-transparent text-slate hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function FieldGroup({
  fields,
  values,
  onChange,
  def,
  emptyHint,
}: {
  fields: TemplateField[];
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
  def: TemplateDefinition;
  emptyHint?: string;
}) {
  if (fields.length === 0) return <p className="text-sm text-slate">{emptyHint}</p>;
  return (
    <div className="flex flex-col gap-6">
      {fields.map((f) => (
        <Field key={f.key} field={f} value={values[f.key]} onChange={(v) => onChange(f.key, v)} blobKeyPrefix={def.id} />
      ))}
    </div>
  );
}

function StyleTab({
  def,
  colors,
  values,
  onChange,
}: {
  def: TemplateDefinition;
  colors: TemplateField[];
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
}) {
  const paletteId = useMotionStore((s) => s.paletteId);
  const setPalette = useMotionStore((s) => s.setPalette);
  const font = useMotionStore((s) => s.font);
  const setFont = useMotionStore((s) => s.setFont);
  const bodyFont = useMotionStore((s) => s.bodyFont);
  const setBodyFont = useMotionStore((s) => s.setBodyFont);
  const applyTheme = useMotionStore((s) => s.applyTheme);
  const currentFont = font ?? "default";
  const currentBodyFont = bodyFont ?? "default";

  // A theme preset only drives these three conventional keys, so only offer them
  // when the template actually has at least one to change.
  const colorKeys = new Set(colors.map((f) => f.key));
  const themeable =
    colorKeys.has(THEME_KEYS.background) || colorKeys.has(THEME_KEYS.text) || colorKeys.has(THEME_KEYS.accent);

  return (
    <div className="flex flex-col gap-7">
      <BrandKitPanel themeable={themeable} />

      <div className="border-t border-mist pt-6">
        <p className={groupLabelCls}>Headline font</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {FONT_CHOICES.map((f) => (
            <FontButton
              key={f.id}
              label={f.label}
              family={f.family}
              active={f.id === currentFont}
              onClick={() => setFont(f.id === "default" ? undefined : f.id)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-mist pt-6">
        <p className={groupLabelCls}>Body font</p>
        <p className="mt-1.5 text-xs text-slate">Sublines, captions and labels.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {BODY_FONT_CHOICES.map((f) => (
            <FontButton
              key={f.id}
              label={f.label}
              family={f.family}
              active={f.id === currentBodyFont}
              onClick={() => setBodyFont(f.id === "default" ? undefined : f.id)}
            />
          ))}
        </div>
      </div>

      {themeable && (
        <div className="border-t border-mist pt-6">
          <p className={groupLabelCls}>Theme presets</p>
          <p className="mt-1.5 text-xs text-slate">
            Recolor any template — background, text and accent in one tap. Every one is contrast-checked.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {THEME_PRESETS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTheme(t.id)}
                title={`${t.name} — ${t.mode} background`}
                className="group flex flex-col gap-1.5 rounded-xl border-2 border-mist p-1.5 text-left transition-colors hover:border-slate hover:bg-subtle"
              >
                <span
                  aria-hidden
                  className="flex h-9 items-center justify-center gap-1 rounded-lg border border-ink/10"
                  style={{ background: t.background }}
                >
                  <span className="text-[13px] font-bold leading-none" style={{ color: t.text }}>
                    Aa
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.accent }} />
                </span>
                <span className="truncate text-[11px] font-semibold text-graphite">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-mist pt-6">
        <p className={groupLabelCls}>Palette</p>
        <p className="mt-1.5 text-xs text-slate">Presets designed for this template specifically.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {def.palettes.map((p) => {
            const active = p.id === paletteId;
            const swatches = Object.values(p.colors);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalette(p.id)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 p-2 text-left transition-colors",
                  active ? "border-primary-strong bg-emerald-tint" : "border-mist hover:border-slate hover:bg-subtle",
                )}
              >
                <span className="flex overflow-hidden rounded-md border border-mist">
                  {swatches.map((c, i) => (
                    <span key={i} className="h-6 w-3" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-graphite">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-mist pt-6">
        <p className={groupLabelCls}>Colors</p>
        <p className="mt-1.5 text-xs text-slate">Pick any color for the background, text and objects — the presets above are just starting points.</p>
        <ContrastHint values={values} />
        <div className="mt-3">
          <FieldGroup fields={colors} values={values} onChange={onChange} def={def} emptyHint="This template has no color options." />
        </div>
      </div>
    </div>
  );
}

function FontButton({
  label,
  family,
  active,
  onClick,
}: {
  label: string;
  family: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "truncate rounded-xl border-2 px-3 py-2.5 text-left text-[15px] font-medium transition-colors",
        active ? "border-primary-strong bg-emerald-tint text-ink" : "border-mist text-graphite hover:border-slate hover:bg-subtle",
      )}
      style={{ fontFamily: `"${family}"` }}
      title={label}
    >
      {label}
    </button>
  );
}

/**
 * Readability check on the user's own text/background pair. Names the problem
 * and gives a number rather than blocking the edit — some templates legitimately
 * put text on a card rather than the background, so this is guidance, not a rule.
 */
function ContrastHint({ values }: { values: Record<string, unknown> }) {
  const bg = values[THEME_KEYS.background];
  const text = values[THEME_KEYS.text];
  if (typeof bg !== "string" || typeof text !== "string") return null;
  const ratio = contrastRatio(text, bg);
  if (ratio === null) return null;
  const ok = ratio >= 4.5;
  const large = ratio >= 3;
  return (
    <p
      className={cn(
        "mt-2.5 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium",
        ok ? "bg-emerald-tint text-primary-strong" : large ? "bg-amber-tint text-ink" : "bg-coral-tint text-ink",
      )}
      role="status"
    >
      <span aria-hidden>{ok ? "✓" : "!"}</span>
      <span>
        Text contrast {ratio.toFixed(1)}:1 —{" "}
        {ok
          ? "easy to read at any size."
          : large
            ? "fine for big headlines, too low for small text."
            : "hard to read. Try a darker text or lighter background."}
      </span>
    </p>
  );
}

/**
 * Brand kit: save the current colors + fonts once, then reapply them to any of
 * the other templates in a tap. Stored in this browser only.
 */
function BrandKitPanel({ themeable }: { themeable: boolean }) {
  const brandKit = useMotionStore((s) => s.brandKit);
  const saveBrandKit = useMotionStore((s) => s.saveBrandKit);
  const applyBrandKit = useMotionStore((s) => s.applyBrandKit);
  const clearBrandKit = useMotionStore((s) => s.clearBrandKit);
  const swatches = brandKit ? [brandKit.background, brandKit.textColor, brandKit.accent].filter(Boolean) : [];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={groupLabelCls}>Brand kit</p>
        {brandKit && (
          <button
            type="button"
            onClick={clearBrandKit}
            className="text-[11px] font-semibold text-slate underline decoration-mist underline-offset-2 hover:text-ink"
          >
            Forget
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-slate">
        {brandKit
          ? "Reuse your colors and fonts on any template."
          : "Save these colors and fonts once, then reuse them on any template."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button variant={brandKit ? "secondary" : "primary"} size="sm" onClick={saveBrandKit}>
          {brandKit ? "Update" : "Save my brand"}
        </Button>
        {brandKit && (
          <>
            <Button variant="primary" size="sm" onClick={applyBrandKit} disabled={!themeable}>
              Apply
            </Button>
            {swatches.length > 0 && (
              <span aria-hidden className="ml-auto flex overflow-hidden rounded-md border border-mist">
                {swatches.map((c, i) => (
                  <span key={i} className="h-6 w-3.5" style={{ background: c }} />
                ))}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MotionTab({
  def,
  motionFields,
  values,
  onChange,
  baseDuration,
}: {
  def: TemplateDefinition;
  motionFields: TemplateField[];
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
  baseDuration: number;
}) {
  const speed = useMotionStore((s) => s.speed);
  const setSpeed = useMotionStore((s) => s.setSpeed);
  const energy = useMotionStore((s) => s.energy);
  const setEnergy = useMotionStore((s) => s.setEnergy);
  const trim = useMotionStore((s) => s.trim);
  const setTrim = useMotionStore((s) => s.setTrim);
  const hold = useMotionStore((s) => s.hold);
  const setHold = useMotionStore((s) => s.setHold);
  const loop = useMotionStore((s) => s.loop);
  const setLoop = useMotionStore((s) => s.setLoop);
  const sound = useMotionStore((s) => s.sound);
  const setSound = useMotionStore((s) => s.setSound);
  const music = useMotionStore((s) => s.music);
  const setMusic = useMotionStore((s) => s.setMusic);
  const soundPack = useMotionStore((s) => s.soundPack);
  const setSoundPack = useMotionStore((s) => s.setSoundPack);
  const length = baseDuration > 0 ? baseDuration / speed : 0;
  // What the export will actually be: the trimmed, held window at the set speed.
  const outLength = Math.max(0.1, baseDuration - Math.min(trim, baseDuration) + hold) / speed;
  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="flex items-baseline justify-between">
          <p className={groupLabelCls}>Speed &amp; length</p>
          <span className="text-sm tabular-nums text-slate">
            {speed.toFixed(2)}× · {length.toFixed(1)}s
          </span>
        </div>
        <input
          type="range"
          className="mt-3 h-1.5 w-full cursor-pointer accent-emerald"
          min={0.25}
          max={3}
          step={0.05}
          value={speed}
          aria-label="Playback speed and length"
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
        <div className="mt-1.5 flex justify-between text-[11px] text-slate">
          <span>Slower / longer</span>
          <span>Faster / shorter</span>
        </div>
      </div>

      <div className="border-t border-mist pt-6">
        <div className="flex items-baseline justify-between">
          <p className={groupLabelCls}>Energy</p>
          <span className="text-sm tabular-nums text-slate">{Math.round(energy * 100)}%</span>
        </div>
        <input
          type="range"
          className="mt-3 h-1.5 w-full cursor-pointer accent-emerald"
          min={0}
          max={2}
          step={0.05}
          value={energy}
          aria-label="Motion energy"
          onChange={(e) => setEnergy(Number(e.target.value))}
        />
        <div className="mt-1.5 flex justify-between text-[11px] text-slate">
          <span>Calm</span>
          <span>Punchy</span>
        </div>
        <p className="mt-2 text-xs text-slate">
          How much bounce and travel the motion has. Timing doesn&rsquo;t change — that&rsquo;s Speed.
        </p>
      </div>

      <div className="border-t border-mist pt-6">
        <div className="flex items-baseline justify-between">
          <p className={groupLabelCls}>Trim &amp; hold</p>
          <span className="text-sm tabular-nums text-slate">{outLength.toFixed(1)}s out</span>
        </div>

        <label className="mt-3 block text-xs font-semibold text-graphite" htmlFor="jima-trim">
          Start at <span className="tabular-nums font-normal text-slate">{trim.toFixed(1)}s</span>
        </label>
        <input
          id="jima-trim"
          type="range"
          className="mt-1.5 h-1.5 w-full cursor-pointer accent-emerald"
          min={0}
          max={Math.max(0, baseDuration - 0.3)}
          step={0.1}
          value={Math.min(trim, Math.max(0, baseDuration - 0.3))}
          onChange={(e) => setTrim(Number(e.target.value))}
        />

        <label className="mt-4 block text-xs font-semibold text-graphite" htmlFor="jima-hold">
          Hold last frame <span className="tabular-nums font-normal text-slate">{hold.toFixed(1)}s</span>
        </label>
        <input
          id="jima-hold"
          type="range"
          className="mt-1.5 h-1.5 w-full cursor-pointer accent-emerald"
          min={0}
          max={5}
          step={0.1}
          value={hold}
          onChange={(e) => setHold(Number(e.target.value))}
        />
        <p className="mt-2 text-xs text-slate">
          Skip a slow intro, or leave the final frame on screen long enough to read.
        </p>
      </div>

      <div className="border-t border-mist pt-6">
        <p className={groupLabelCls}>Options</p>
        <div className="mt-3">
          <FieldGroup fields={motionFields} values={values} onChange={onChange} def={def} emptyHint="No motion options." />
        </div>
      </div>

      <div className="border-t border-mist pt-6">
        <label className="flex items-center justify-between">
          <span className="text-sm font-semibold text-graphite">Sound effects</span>
          <Switch checked={sound} onChange={setSound} label="Sound effects" />
        </label>
        <p className="mt-1.5 text-xs text-slate">
          Synthesized to match this template&rsquo;s motion — plays in the preview and is baked into MP4/WebM
          exports.
        </p>
        {sound && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Sound pack">
              {SOUND_PACKS.map((p) => {
                const active = p.id === soundPack;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSoundPack(p.id)}
                    aria-pressed={active}
                    title={p.hint}
                    className={cn(
                      "rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors",
                      active ? "border-primary-strong bg-emerald-tint text-ink" : "border-mist text-graphite hover:border-slate",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate">
              {SOUND_PACKS.find((p) => p.id === soundPack)?.hint} Tuned for {PROFILE_LABEL[profileForTemplate(def)]}.
            </p>

            <label className="mt-5 flex items-center justify-between">
              <span className="text-sm font-semibold text-graphite">Music bed</span>
              <Switch checked={music} onChange={setMusic} label="Music bed" />
            </label>
            <p className="mt-1.5 text-xs text-slate">
              A short loop written from this template&rsquo;s key and timed to its exact length. It ducks
              under the effects automatically. Still synthesized — no audio files.
            </p>
          </>
        )}
      </div>

      {def.loopable && (
        <div className="border-t border-mist pt-6">
          <label className="flex items-center justify-between">
            <span className="text-sm font-semibold text-graphite">Loop</span>
            <Switch checked={loop} onChange={setLoop} label="Loop" />
          </label>
        </div>
      )}
    </div>
  );
}
