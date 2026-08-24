import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import type { TemplateField } from "@jima/engine";
import { isImageValue, storeImageBlob, type ImageValue } from "../state/persistence";
import { Button, Switch, cn } from "../../ui";

/** Reject very large images before they hit IndexedDB (rough quota safety). */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

interface FieldProps {
  field: TemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
  blobKeyPrefix: string;
}

/**
 * A short, opinionated emoji set for social copy — the ones that actually turn
 * up in captions. Not a full picker: the OS already has one (and a 3,000-glyph
 * grid in a sidebar would be worse than the OS one), this is just the fast path.
 */
const EMOJI = [
  "🔥", "✨", "🎉", "💫", "⭐", "❤️", "😍", "😂", "🙌", "👀",
  "✅", "📈", "💡", "🚀", "🎁", "🏆", "📣", "⏰", "💰", "🛒",
  "📍", "✈️", "☀️", "🌙", "🍀", "☕", "🎧", "📷", "👉", "🤝",
];

const labelCls = "block text-sm font-semibold text-graphite";
const helpCls = "mt-1 text-xs text-slate";
const inputCls =
  "w-full rounded-xl border border-mist bg-paper px-3 py-2.5 text-[15px] text-ink placeholder:text-muted transition-colors focus:border-primary-strong focus:ring-2 focus:ring-emerald-ring";

export function Field({ field, value, onChange, blobKeyPrefix }: FieldProps) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={labelCls}>
          {field.label}
          {field.optional && field.type !== "color" ? <span className="ml-1 font-normal text-slate">(optional)</span> : null}
        </label>
        {field.type === "text" || field.type === "textarea" ? (
          <div className="flex shrink-0 items-center gap-2">
            <EmojiButton
              label={field.label}
              disabled={
                field.maxLength !== undefined && typeof value === "string" && value.length >= field.maxLength
              }
              onPick={(emoji) => onChange(`${typeof value === "string" ? value : ""}${emoji}`)}
            />
            <CharCount value={value} max={field.maxLength} />
          </div>
        ) : null}
      </div>
      <div className="mt-1.5">
        <Control id={id} field={field} value={value} onChange={onChange} blobKeyPrefix={blobKeyPrefix} />
      </div>
      {field.help ? <p className={helpCls}>{field.help}</p> : null}
    </div>
  );
}

function CharCount({ value, max }: { value: unknown; max?: number | undefined }) {
  if (!max) return null;
  const len = typeof value === "string" ? value.length : 0;
  return (
    <span className={cn("text-xs tabular-nums", len > max ? "text-error" : "text-slate")}>
      {len}/{max}
    </span>
  );
}

function Control({
  id,
  field,
  value,
  onChange,
  blobKeyPrefix,
}: FieldProps & { id: string }) {
  switch (field.type) {
    case "text":
      return (
        <input
          id={id}
          type="text"
          className={inputCls}
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <textarea
          id={id}
          className={cn(inputCls, "min-h-20 resize-y")}
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textlist":
      return <TextList id={id} field={field} value={value} onChange={onChange} />;
    case "color":
      return <ColorControl id={id} value={typeof value === "string" ? value : "#000000"} onChange={onChange} />;
    case "select":
      return <SelectControl id={id} field={field} value={value} onChange={onChange} />;
    case "slider":
      return <SliderControl id={id} field={field} value={value} onChange={onChange} />;
    case "toggle":
      return <ToggleControl id={id} value={value === true} onChange={onChange} />;
    case "image":
      return <ImageControl id={id} value={value} onChange={onChange} blobKeyPrefix={blobKeyPrefix} fieldKey={field.key} />;
  }
}

/**
 * Appends an emoji to a text field. Deliberately append-only: tracking the
 * caret across a controlled input, undo coalescing and IME composition is a lot
 * of machinery for "put a fire at the end", which is what people do anyway.
 */
function EmojiButton({
  label,
  disabled,
  onPick,
}: {
  label: string;
  disabled?: boolean;
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-label={`Add an emoji to ${label}`}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md px-1 text-sm leading-none text-slate transition-colors hover:bg-subtle hover:text-graphite disabled:pointer-events-none disabled:opacity-40"
      >
        <span aria-hidden>☺</span>
      </button>
      {open && (
        <div
          role="group"
          aria-label="Emoji"
          className="absolute right-0 top-6 z-30 grid w-56 grid-cols-6 gap-0.5 rounded-xl border border-mist bg-paper p-2 shadow-pop"
        >
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={e}
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="rounded-md py-1 text-lg leading-none transition-colors hover:bg-subtle"
            >
              <span aria-hidden>{e}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TextList({ field, value, onChange }: { id: string; field: TemplateField; value: unknown; onChange: (v: unknown) => void }) {
  const items = Array.isArray(value) ? (value as string[]) : [];
  const min = field.minItems ?? 1;
  const max = field.maxItems ?? 6;
  const set = (next: string[]) => onChange(next);
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            className={inputCls}
            value={item}
            maxLength={field.maxLength}
            aria-label={`${field.label} ${i + 1}`}
            onChange={(e) => set(items.map((it, j) => (j === i ? e.target.value : it)))}
          />
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-slate transition-colors hover:bg-subtle hover:text-graphite disabled:pointer-events-none disabled:opacity-40"
            disabled={items.length <= min}
            aria-label={`Remove item ${i + 1}`}
            onClick={() => set(items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      {items.length < max ? (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => set([...items, ""])}>
          + Add
        </Button>
      ) : null}
    </div>
  );
}

function ColorControl({ id, value, onChange }: { id: string; value: string; onChange: (v: unknown) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label
        className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-mist shadow-xs transition-colors hover:border-primary-strong"
        style={{ background: value }}
      >
        <input
          id={id}
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <input
        type="text"
        className={cn(inputCls, "font-mono uppercase")}
        value={value}
        aria-label="Hex color"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectControl({ id, field, value, onChange }: { id: string; field: TemplateField; value: unknown; onChange: (v: unknown) => void }) {
  const options = field.options ?? [];
  const current = typeof value === "string" ? value : options[0]?.value;
  if (options.length <= 4) {
    return (
      <div id={id} role="radiogroup" aria-label={field.label} className="grid grid-flow-col gap-1 rounded-xl bg-subtle p-1">
        {options.map((opt) => {
          const active = opt.value === current;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                active ? "bg-lime text-void shadow-xs" : "text-slate hover:text-ink",
              )}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <select id={id} className={inputCls} value={current} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function SliderControl({ id, field, value, onChange }: { id: string; field: TemplateField; value: unknown; onChange: (v: unknown) => void }) {
  const min = field.min ?? 0;
  const max = field.max ?? 1;
  const step = field.step ?? 0.01;
  const num = typeof value === "number" ? value : min;
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        className="h-1.5 flex-1 cursor-pointer accent-emerald"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-slate">{num.toFixed(step < 0.1 ? 2 : 1)}</span>
    </div>
  );
}

function ToggleControl({ id, value, onChange }: { id: string; value: boolean; onChange: (v: unknown) => void }) {
  return <Switch id={id} checked={value} onChange={(next) => onChange(next)} />;
}

function ImageControl({
  value,
  onChange,
  blobKeyPrefix,
  fieldKey,
}: {
  id: string;
  value: unknown;
  onChange: (v: unknown) => void;
  blobKeyPrefix: string;
  fieldKey: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const img = isImageValue(value) ? (value as ImageValue) : null;
  const [error, setError] = useState<string | null>(null);
  // Track the object URL we created so it can be revoked when replaced/removed
  // or when the field unmounts — otherwise each pick leaks its image Blob.
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const setImage = (next: ImageValue | "") => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = typeof next === "object" ? next.url : null;
    onChange(next);
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is too large (max 20 MB).");
      return;
    }
    const key = `${blobKeyPrefix}:${fieldKey}`;
    try {
      await storeImageBlob(key, file);
    } catch {
      setError("Couldn't save that image — your browser storage may be full.");
      return;
    }
    setImage({ __img: true, key, name: file.name, url: URL.createObjectURL(file) });
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  if (img) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-mist bg-paper p-2 shadow-xs">
        <img src={img.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
        <span className="min-w-0 flex-1 truncate text-sm text-graphite">{img.name}</span>
        <Button variant="ghost" size="sm" onClick={() => setImage("")}>
          Remove
        </Button>
      </div>
    );
  }
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-mist bg-subtle px-4 py-6 text-center transition-colors hover:border-primary-strong hover:bg-emerald-tint">
      <span className="text-sm font-semibold text-ink">Drop an image or click</span>
      <span className="text-xs text-slate">Stays in your browser — never uploaded</span>
      {error && <span className="mt-1 text-xs font-semibold text-error">{error}</span>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInput} />
    </label>
  );
}
