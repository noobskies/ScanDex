/**
 * Minimal TCGdex (https://tcgdex.dev) REST client plus the card-resolution
 * strategy: turn an OCR'd collector number into a concrete card.
 *
 * Resolution order:
 *   1. SV-era set code printed on the card (e.g. "PAL EN") via a static map.
 *   2. Match the printed denominator against each set's official card count,
 *      probe the matching sets for the collector number, and rank hits by
 *      whether the card's name also appears in the OCR text.
 */

import type { CollectorCandidate } from './collectorNumber';

export const TCGDEX_BASE = 'https://api.tcgdex.net/v2/en';

export interface SetResume {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: { total: number; official: number };
}

export interface TcgdexCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  rarity?: string;
  set?: { id: string; name: string };
}

export interface LookupResult {
  card: TcgdexCard;
  /** Other sets that also contain this collector number. */
  alternatives: TcgdexCard[];
}

/**
 * Set codes printed on Scarlet & Violet era English cards → TCGdex set ids.
 * Fast path only; unknown codes fall through to denominator matching.
 */
export const SET_CODE_TO_ID: Record<string, string> = {
  SVI: 'sv01',
  PAL: 'sv02',
  OBF: 'sv03',
  MEW: 'sv03.5',
  PAR: 'sv04',
  PAF: 'sv04.5',
  TEF: 'sv05',
  TWM: 'sv06',
  SFA: 'sv06.5',
  SCR: 'sv07',
  SSP: 'sv08',
  PRE: 'sv08.5',
  JTG: 'sv09',
  DRI: 'sv10',
};

type FetchLike = typeof fetch;

async function getJson<T>(url: string, fetchFn: FetchLike): Promise<T | null> {
  try {
    const res = await fetchFn(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

let setsCache: SetResume[] | null = null;

export async function getSets(fetchFn: FetchLike = fetch): Promise<SetResume[]> {
  if (setsCache) return setsCache;
  const sets = await getJson<SetResume[]>(`${TCGDEX_BASE}/sets`, fetchFn);
  if (sets) setsCache = sets;
  return sets ?? [];
}

/** Test seam / offline refresh hook. */
export function clearSetsCache(): void {
  setsCache = null;
}

/**
 * TCGdex local ids are usually unpadded ("25", "TG12") but some special sets
 * keep zero padding, so probe both spellings.
 */
export function localIdVariants(localId: string): string[] {
  const m = /^([A-Z]*)0*(\d+)$/.exec(localId);
  if (!m) return [localId];
  const unpadded = m[1] + m[2];
  return unpadded === localId ? [localId] : [unpadded, localId];
}

export async function getCard(
  setId: string,
  localId: string,
  fetchFn: FetchLike = fetch,
): Promise<TcgdexCard | null> {
  for (const variant of localIdVariants(localId)) {
    const card = await getJson<TcgdexCard>(
      `${TCGDEX_BASE}/sets/${encodeURIComponent(setId)}/${encodeURIComponent(variant)}`,
      fetchFn,
    );
    if (card && card.name) return card;
  }
  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** True when the card's name shows up in what OCR read off the card. */
function nameAppearsInText(cardName: string, ocrText: string): boolean {
  const name = normalize(cardName);
  return name.length >= 3 && normalize(ocrText).includes(name);
}

/** How many sets with a matching denominator we are willing to probe. */
const MAX_SET_PROBES = 12;

export async function lookupCard(
  candidate: CollectorCandidate,
  ocrText: string,
  fetchFn: FetchLike = fetch,
): Promise<LookupResult | null> {
  // Fast path: the card told us its set.
  if (candidate.setCode) {
    const setId = SET_CODE_TO_ID[candidate.setCode];
    if (setId) {
      const card = await getCard(setId, candidate.localId, fetchFn);
      if (card) return { card, alternatives: [] };
    }
  }

  if (candidate.printedTotal === undefined) return null;

  const sets = await getSets(fetchFn);
  // The API returns sets oldest-first; prefer newer sets when ambiguous.
  const matching = sets
    .filter((s) => s.cardCount?.official === candidate.printedTotal)
    .reverse()
    .slice(0, MAX_SET_PROBES);
  if (matching.length === 0) return null;

  const probes = await Promise.all(
    matching.map((s) => getCard(s.id, candidate.localId, fetchFn)),
  );
  const hits = probes.filter((c): c is TcgdexCard => c !== null);
  if (hits.length === 0) return null;

  hits.sort(
    (a, b) =>
      Number(nameAppearsInText(b.name, ocrText)) -
      Number(nameAppearsInText(a.name, ocrText)),
  );
  return { card: hits[0], alternatives: hits.slice(1) };
}

/** Full image URL for a TCGdex card asset. */
export function cardImageUrl(
  card: Pick<TcgdexCard, 'image'>,
  quality: 'low' | 'high' = 'high',
): string | null {
  return card.image ? `${card.image}/${quality}.webp` : null;
}
