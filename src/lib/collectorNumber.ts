/**
 * Extracts Pokémon TCG collector numbers from raw OCR text.
 *
 * Modern cards print an identifier in the bottom corner in one of two shapes:
 *   - fraction:  "025/198", "TG12/TG30", "GG23/GG70", "SV049/SV122", "RC5/RC32"
 *   - promo:     "SWSH039", "SM210", "XY67"
 * Scarlet & Violet era cards additionally print a set code next to the
 * regulation mark, e.g. "PAL EN".
 */

export interface CollectorCandidate {
  /** Collector number as printed, e.g. "025" or "TG12" */
  localId: string;
  /** Printed set size (denominator), absent for promo-style numbers */
  printedTotal?: number;
  /** Set code hint, e.g. "PAL" (SV-era cards only) */
  setCode?: string;
  /** Stable identity used for frame-to-frame voting */
  key: string;
}

/** Characters ML Kit commonly confuses for digits in this context. */
const DIGIT_FIXES: Record<string, string> = { O: '0', o: '0', I: '1', l: '1' };

/**
 * Splits a token like "TG12" into prefix + digits, repairing common OCR
 * digit confusions. Returns null when the tail is not purely numeric.
 */
function splitToken(token: string): { prefix: string; digits: string } | null {
  const m = /^([A-Z]{0,4}?)([0-9OIl]{1,3})$/.exec(token);
  if (!m) return null;
  const digits = m[2].replace(/[OIl]/g, (c) => DIGIT_FIXES[c]);
  if (!/^\d{1,3}$/.test(digits)) return null;
  return { prefix: m[1].toUpperCase(), digits };
}

const FRACTION_RE = /\b([A-Z]{0,4}[0-9OIl]{1,3})\s*[/|]\s*([A-Z]{0,4}[0-9OIl]{1,3})\b/g;

/** Promo numbering used by English promo sets. */
const PROMO_RE = /\b(SWSH|SVP|SM|XY|BW)\s?0?(\d{2,3})\b/g;

/** SV-era set code printed next to the language, e.g. "PAL EN". */
const SET_CODE_RE = /\b([A-Z]{2,4})\s?(?:EN|FR|DE|IT|ES|PT)\b/;

function fractionCandidates(text: string): CollectorCandidate[] {
  const out: CollectorCandidate[] = [];
  for (const m of text.matchAll(FRACTION_RE)) {
    const left = splitToken(m[1].toUpperCase());
    const right = splitToken(m[2].toUpperCase());
    if (!left || !right) continue;
    // Prefixed numbering (TG/GG/SV/RC…) repeats the prefix on both sides of
    // the slash; tolerate OCR dropping one of them, reject a mismatch.
    if (left.prefix && right.prefix && left.prefix !== right.prefix) continue;
    const prefix = left.prefix || right.prefix;
    const printedTotal = parseInt(right.digits, 10);
    const numeric = parseInt(left.digits, 10);
    if (printedTotal < 1 || numeric < 0) continue;
    // A printed total below ~15 is almost certainly OCR noise (damage/HP text).
    if (!prefix && printedTotal < 15) continue;
    const localId = prefix + left.digits;
    out.push({
      localId,
      printedTotal,
      key: `${prefix}${numeric}/${prefix}${printedTotal}`,
    });
  }
  return out;
}

function promoCandidates(text: string): CollectorCandidate[] {
  const out: CollectorCandidate[] = [];
  for (const m of text.matchAll(PROMO_RE)) {
    const prefix = m[1].toUpperCase();
    const localId = `${prefix}${m[2].padStart(prefix === 'XY' || prefix === 'BW' ? 2 : 3, '0')}`;
    out.push({ localId, key: localId });
  }
  return out;
}

/**
 * Parses OCR text into collector-number candidates, best match first.
 * Fraction-style matches outrank promo-style ones because the promo pattern
 * is short enough to fire on unrelated text.
 */
export function parseCollectorNumber(text: string): CollectorCandidate[] {
  const setCode = SET_CODE_RE.exec(text)?.[1];
  const fractions = fractionCandidates(text);
  const promos = fractions.length > 0 ? [] : promoCandidates(text);
  const all = [...fractions, ...promos];
  if (setCode) {
    for (const c of all) {
      c.setCode = setCode;
      c.key = `${setCode}:${c.key}`;
    }
  }
  // De-duplicate while preserving order.
  const seen = new Set<string>();
  return all.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
}
