import {
  cardImageUrl,
  clearSetsCache,
  localIdVariants,
  lookupCard,
  TCGDEX_BASE,
} from '../tcgdex';
import type { CollectorCandidate } from '../collectorNumber';

type Responder = (url: string) => unknown | undefined;

function fakeFetch(responder: Responder): typeof fetch {
  return (async (url: RequestInfo | URL) => {
    const body = responder(String(url));
    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
}

const SETS = [
  { id: 'base1', name: 'Base Set', cardCount: { total: 102, official: 102 } },
  { id: 'sv02', name: 'Paldea Evolved', cardCount: { total: 279, official: 193 } },
  { id: 'xx99', name: 'Fake Newer Set', cardCount: { total: 200, official: 193 } },
];

const PIKACHU = {
  id: 'sv02-25',
  localId: '25',
  name: 'Pikachu',
  image: 'https://assets.tcgdex.net/en/sv/sv02/025',
};

beforeEach(() => clearSetsCache());

describe('localIdVariants', () => {
  it('tries the unpadded spelling first', () => {
    expect(localIdVariants('025')).toEqual(['25', '025']);
    expect(localIdVariants('SV049')).toEqual(['SV49', 'SV049']);
  });

  it('returns a single variant when unpadded already', () => {
    expect(localIdVariants('25')).toEqual(['25']);
    expect(localIdVariants('TG12')).toEqual(['TG12']);
  });
});

describe('lookupCard', () => {
  const candidate: CollectorCandidate = {
    localId: '025',
    printedTotal: 193,
    key: '25/193',
  };

  it('resolves via set-code fast path without fetching the set list', async () => {
    const urls: string[] = [];
    const fetchFn = fakeFetch((url) => {
      urls.push(url);
      if (url === `${TCGDEX_BASE}/sets/sv02/25`) return PIKACHU;
      return undefined;
    });
    const result = await lookupCard(
      { ...candidate, setCode: 'PAL', key: 'PAL:25/193' },
      'Pikachu 025/193 PAL EN',
      fetchFn,
    );
    expect(result?.card.id).toBe('sv02-25');
    expect(urls).toEqual([`${TCGDEX_BASE}/sets/sv02/25`]);
  });

  it('falls back to matching the printed total against set sizes', async () => {
    const fetchFn = fakeFetch((url) => {
      if (url.endsWith('/sets')) return SETS;
      if (url === `${TCGDEX_BASE}/sets/sv02/25`) return PIKACHU;
      return undefined;
    });
    const result = await lookupCard(candidate, 'Pikachu', fetchFn);
    expect(result?.card.id).toBe('sv02-25');
  });

  it('ranks ambiguous hits by name presence in the OCR text', async () => {
    const fetchFn = fakeFetch((url) => {
      if (url.endsWith('/sets')) return SETS;
      if (url === `${TCGDEX_BASE}/sets/sv02/25`) return PIKACHU;
      if (url === `${TCGDEX_BASE}/sets/xx99/25`)
        return { id: 'xx99-25', localId: '25', name: 'Decoymon' };
      return undefined;
    });
    const result = await lookupCard(candidate, 'PIKACHU hp 60', fetchFn);
    expect(result?.card.id).toBe('sv02-25');
    expect(result?.alternatives.map((c) => c.id)).toEqual(['xx99-25']);
  });

  it('returns null when nothing matches', async () => {
    const fetchFn = fakeFetch((url) => (url.endsWith('/sets') ? SETS : undefined));
    expect(await lookupCard({ localId: '999', printedTotal: 7, key: '999/7' }, '', fetchFn)).toBeNull();
  });

  it('survives network failures', async () => {
    const fetchFn = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await lookupCard(candidate, '', fetchFn)).toBeNull();
  });
});

describe('cardImageUrl', () => {
  it('appends quality and extension', () => {
    expect(cardImageUrl(PIKACHU)).toBe(
      'https://assets.tcgdex.net/en/sv/sv02/025/high.webp',
    );
  });

  it('returns null when the card has no image', () => {
    expect(cardImageUrl({ image: undefined })).toBeNull();
  });
});
