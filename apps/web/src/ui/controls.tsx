import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

/*
 * Form primitives shared by Jima Captions' style panel, Jima Motion's inspector
 * and the brand kit. One implementation each — before the merge these existed
 * twice, in two different visual languages, which is precisely the seam a user
 * feels when a "suite" is really two apps behind one door.
 *
 * All of them are dark-chrome controls: surface-2 fills, hairline rings, lime
 * for the active/checked state.
 */

/** Label + optional hint above a control. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
  action,
}: {
  label: string;
  hint?: string | undefined;
  htmlFor?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className={cn("block", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-silver">
          {label}
        </label>
        {action}
      </div>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs leading-snug text-dim">{hint}</p>}
    </div>
  );
}

const CONTROL_BASE =
  "w-full rounded-input bg-surface-2 px-3 text-sm text-chalk ring-1 ring-inset ring-line " +
  "transition-colors placeholder:text-dim hover:ring-line-2 focus:ring-lime/60 focus:outline-none " +
  "disabled:opacity-40 disabled:pointer-events-none";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL_BASE, "h-10", className)} {...props} />;
}

export function TextArea({
  className,
  rows = 3,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(CONTROL_BASE, "resize-y py-2 leading-relaxed", className)} {...props} />;
}

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Native `<select>` with the UA chrome stripped. Native (rather than a custom
 * listbox) on purpose: it gets mobile's wheel picker, type-ahead and keyboard
 * handling for free, and none of those are worth re-implementing badly.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  hint,
  className,
  disabled,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  hint?: string | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(CONTROL_BASE, "h-10 cursor-pointer appearance-none pr-9 font-medium")}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-surface text-chalk">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dim" />
      </div>
    </Field>
  );
}

/** Compact segmented control: sunken track, active option as a raised pill. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
  className?: string | undefined;
}) {
  const track = (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex w-full rounded-full bg-void p-1 ring-1 ring-inset ring-line", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition-all duration-200",
              active ? "bg-lime text-void shadow-xs" : "text-ash hover:text-chalk",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
  if (hideLabel) return track;
  return (
    <div>
      <span className="text-[13px] font-medium text-silver">{label}</span>
      <div className="mt-1.5">{track}</div>
    </div>
  );
}

/** Labelled range input with a live monospace read-out. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean | undefined;
}) {
  const id = useId();
  return (
    <div className="block">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-silver">
          {label}
        </label>
        <span className="font-mono text-xs tabular-nums text-dim">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        className="mt-1.5 w-full"
      />
    </div>
  );
}

/**
 * On/off switch.
 *
 * The knob carries an explicit `left`, which is load-bearing: an absolutely
 * positioned child with `left: auto` falls back to its *static* position, and a
 * `<button>` centres its inline content — without it the knob starts mid-track.
 */
export function Switch({
  checked,
  onChange,
  id,
  label,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string | undefined;
  label?: string | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      {...(id ? { id } : {})}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      {...(label ? { "aria-label": label } : {})}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
        checked ? "bg-lime" : "bg-surface-3 ring-1 ring-inset ring-line",
        className,
      )}
    >
      {/* 44px track, 20px knob, 2px inset → travels exactly 20px. */}
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow-xs transition-transform",
          checked ? "bg-void translate-x-5" : "bg-silver",
        )}
      />
    </button>
  );
}

/** Row layout: label on the left, switch on the right. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string | undefined;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-[13px] font-medium text-silver">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-dim">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

/** Colour swatch that opens the native picker. */
export function ColorField({
  label,
  value,
  onChange,
  swatches,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Optional quick-pick row, e.g. the current brand kit's colours. */
  swatches?: string[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-silver">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tabular-nums text-dim">{value}</span>
          <label className="relative block h-8 w-11 cursor-pointer overflow-hidden rounded-[10px] ring-1 ring-inset ring-line-2 transition-transform hover:scale-105">
            <span className="block h-full w-full" style={{ background: value }} />
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={label}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>
      {swatches && swatches.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={`Use ${c}`}
              title={c}
              className={cn(
                "h-5 w-5 rounded-md ring-1 ring-inset transition-transform hover:scale-110",
                c.toLowerCase() === value.toLowerCase() ? "ring-2 ring-lime" : "ring-line-2",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
