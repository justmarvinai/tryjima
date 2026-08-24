// Deterministic number formatting (no toLocaleString — that varies by locale).

/** Group an integer's digits with a separator, e.g. 10000 → "10,000". */
export function groupThousands(n: number, sep = ","): string {
  if (!Number.isFinite(n)) return "0";
  const neg = n < 0;
  // BigInt keeps very large magnitudes as plain digits (Number.toString would
  // switch to exponential notation ≥1e21 and corrupt the grouping).
  const digits = BigInt(Math.round(Math.abs(n))).toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += sep;
    out += digits[i];
  }
  return (neg ? "-" : "") + out;
}

/**
 * Parse the numeric magnitude from a display string like "10,000", "1.2M",
 * "$2M", "128K", "24.5" or "45%". Understands an optional sign, thousands
 * commas, a decimal part, and a K/M/B/T magnitude suffix. Returns 0 when no
 * number is present (never NaN).
 */
export function parseTargetNumber(value: string): number {
  const m = value.match(/(-)?\s*(\d[\d,]*)(?:\.(\d+))?\s*([kmbt])?/i);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const intPart = (m[2] ?? "").replace(/,/g, "");
  const frac = m[3] ?? "";
  const base = Number(frac ? `${intPart}.${frac}` : intPart);
  if (!Number.isFinite(base)) return 0;
  const suffix = (m[4] ?? "").toLowerCase();
  const mult = suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : suffix === "b" ? 1e9 : suffix === "t" ? 1e12 : 1;
  return sign * base * mult;
}
