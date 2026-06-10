import { extractPrices, formatAmount, formatPriceLines } from '../pricing';

const FULL_PRICING = {
  tcgplayer: {
    updated: '2026-06-09',
    unit: 'USD',
    holofoil: { lowPrice: 2.5, midPrice: 4.0, highPrice: 12.0, marketPrice: 4.12 },
    'reverse-holofoil': { lowPrice: 1.0, marketPrice: 2.3 },
    normal: { lowPrice: 0.5, midPrice: 1.1 },
  },
  cardmarket: {
    updated: '2026-06-09',
    unit: 'EUR',
    avg: 3.5,
    low: 1.9,
    trend: 3.8,
  },
};

describe('extractPrices', () => {
  it('extracts TCGplayer variants preferring marketPrice', () => {
    const prices = extractPrices(FULL_PRICING);
    const holo = prices.find((p) => p.variant === 'Holo');
    expect(holo).toMatchObject({ source: 'TCGplayer', amount: 4.12, currency: 'USD' });
  });

  it('falls back to midPrice when marketPrice is missing', () => {
    const normal = extractPrices(FULL_PRICING).find((p) => p.variant === 'Normal');
    expect(normal?.amount).toBe(1.1);
  });

  it('extracts Cardmarket trend price', () => {
    const cm = extractPrices(FULL_PRICING).find((p) => p.source === 'Cardmarket');
    expect(cm).toMatchObject({ amount: 3.8, currency: 'EUR' });
  });

  it('handles missing or junk pricing', () => {
    expect(extractPrices(undefined)).toEqual([]);
    expect(extractPrices(null)).toEqual([]);
    expect(extractPrices('cheap')).toEqual([]);
    expect(extractPrices({ tcgplayer: { unit: 'USD', updated: 'x' } })).toEqual([]);
  });

  it('ignores zero and non-numeric prices', () => {
    expect(
      extractPrices({ tcgplayer: { normal: { marketPrice: 0, lowPrice: 'n/a' } } }),
    ).toEqual([]);
  });

  it('keeps unknown variant keys readable', () => {
    const prices = extractPrices({
      tcgplayer: { 'weird-variant': { marketPrice: 9.99 } },
    });
    expect(prices[0].variant).toBe('weird-variant');
  });
});

describe('formatAmount', () => {
  it('uses currency symbols when known', () => {
    expect(formatAmount(4.12, 'USD')).toBe('$4.12');
    expect(formatAmount(3.8, 'EUR')).toBe('€3.80');
  });

  it('falls back to the currency code', () => {
    expect(formatAmount(100, 'JPY')).toBe('100.00 JPY');
  });
});

describe('formatPriceLines', () => {
  it('renders one line per source with variants', () => {
    expect(formatPriceLines(FULL_PRICING)).toEqual([
      'TCGplayer: Holo $4.12 · Reverse Holo $2.30 · Normal $1.10',
      'Cardmarket: €3.80',
    ]);
  });

  it('omits the variant label for a lone normal print', () => {
    expect(
      formatPriceLines({ tcgplayer: { unit: 'USD', normal: { marketPrice: 1.2 } } }),
    ).toEqual(['TCGplayer: $1.20']);
  });

  it('returns nothing when there are no prices', () => {
    expect(formatPriceLines(undefined)).toEqual([]);
  });
});
