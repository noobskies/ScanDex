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
    const amount =
      asPrice(cardmarket.trend) ??
      asPrice(cardmarket.avg) ??
      asPrice(cardmarket.avg7) ??
      asPrice(cardmarket.low);
    if (amount !== undefined) {
      out.push({ source: 'Cardmarket', amount, currency });
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

  const tcgplayer = entries.filter((e) => e.source === 'TCGplayer');
  if (tcgplayer.length === 1 && tcgplayer[0].variant === 'Normal') {
    lines.push(
      `TCGplayer: ${formatAmount(tcgplayer[0].amount, tcgplayer[0].currency)}`,
    );
  } else if (tcgplayer.length > 0) {
    const parts = tcgplayer.map(
      (e) => `${e.variant} ${formatAmount(e.amount, e.currency)}`,
    );
    lines.push(`TCGplayer: ${parts.join(' · ')}`);
  }

  const cardmarket = entries.find((e) => e.source === 'Cardmarket');
  if (cardmarket) {
    lines.push(
      `Cardmarket: ${formatAmount(cardmarket.amount, cardmarket.currency)}`,
    );
  }

  return lines;
}
