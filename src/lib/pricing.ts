/**
 * Extracts market prices from a TCGdex card's `pricing` block.
 *
 * TCGdex aggregates TCGplayer (USD) and Cardmarket (EUR) prices, refreshed
 * daily. The shape varies per card — TCGplayer prices are keyed by variant
 * ("normal", "holofoil", "reverse-holofoil"), Cardmarket is a flat object —
 * so parse defensively and surface whatever exists.
 */

export interface PriceEntry {
  source: 'TCGplayer' | 'Cardmarket';
  /** Print variant for TCGplayer prices, e.g. "Holo". */
  variant?: string;
  amount: number;
  currency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  holofoil: 'Holo',
  'reverse-holofoil': 'Reverse Holo',
  '1st-edition': '1st Ed.',
  '1st-edition-holofoil': '1st Ed. Holo',
  unlimited: 'Unlimited',
  'unlimited-holofoil': 'Unlimited Holo',
};

function asPrice(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
}

function record(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function extractPrices(pricing: unknown): PriceEntry[] {
  const p = record(pricing);
  if (!p) return [];
  const out: PriceEntry[] = [];

  const tcgplayer = record(p.tcgplayer);
  if (tcgplayer) {
    const currency =
      typeof tcgplayer.unit === 'string' ? tcgplayer.unit : 'USD';
    for (const [key, value] of Object.entries(tcgplayer)) {
      const variant = record(value);
      if (!variant) continue;
      const amount =
        asPrice(variant.marketPrice) ??
        asPrice(variant.midPrice) ??
        asPrice(variant.lowPrice);
      if (amount !== undefined) {
        out.push({
          source: 'TCGplayer',
          variant: VARIANT_LABELS[key] ?? key,
          amount,
          currency,
        });
      }
    }
  }

  const cardmarket = record(p.cardmarket);
  if (cardmarket) {
    const currency =
      typeof cardmarket.unit === 'string' ? cardmarket.unit : 'EUR';
    // Cardmarket exposes holo prices as "-holo" suffixed fields.
    const pick = (suffix: string) =>
      asPrice(cardmarket[`trend${suffix}`]) ??
      asPrice(cardmarket[`avg${suffix}`]) ??
      asPrice(cardmarket[`avg7${suffix}`]) ??
      asPrice(cardmarket[`low${suffix}`]);
    const normal = pick('');
    if (normal !== undefined) {
      out.push({ source: 'Cardmarket', variant: 'Normal', amount: normal, currency });
    }
    const holo = pick('-holo');
    if (holo !== undefined) {
      out.push({ source: 'Cardmarket', variant: 'Holo', amount: holo, currency });
    }
  }

  return out;
}

export function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const value = amount.toFixed(2);
  return symbol ? `${symbol}${value}` : `${value} ${currency}`;
}

/**
 * One display line per price source, e.g.
 *   "TCGplayer: Holo $4.12 · Normal $1.05"
 *   "Cardmarket: €3.80"
 */
export function formatPriceLines(pricing: unknown): string[] {
  const entries = extractPrices(pricing);
  const lines: string[] = [];

  for (const source of ['TCGplayer', 'Cardmarket'] as const) {
    const forSource = entries.filter((e) => e.source === source);
    if (forSource.length === 0) continue;
    if (forSource.length === 1 && (forSource[0].variant ?? 'Normal') === 'Normal') {
      lines.push(
        `${source}: ${formatAmount(forSource[0].amount, forSource[0].currency)}`,
      );
    } else {
      const parts = forSource.map(
        (e) => `${e.variant} ${formatAmount(e.amount, e.currency)}`,
      );
      lines.push(`${source}: ${parts.join(' · ')}`);
    }
  }

  return lines;
}
