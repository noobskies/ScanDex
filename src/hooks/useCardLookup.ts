import { useEffect, useRef, useState } from 'react';
import type { CollectorCandidate } from '../lib/collectorNumber';
import { lookupCard, LookupResult } from '../lib/tcgdex';

export type LookupStatus = 'idle' | 'searching' | 'found' | 'not_found';

export interface CardLookupState {
  status: LookupStatus;
  result: LookupResult | null;
  /** The candidate the current result belongs to. */
  candidateKey: string | null;
}

/**
 * Resolves a stable scan candidate against TCGdex. Re-queries only when the
 * stable candidate's key changes, and ignores responses that arrive after a
 * newer candidate has taken over.
 */
export function useCardLookup(
  candidate: CollectorCandidate | null,
  ocrText: string,
): CardLookupState {
  const [state, setState] = useState<CardLookupState>({
    status: 'idle',
    result: null,
    candidateKey: null,
  });
  const activeKey = useRef<string | null>(null);
  // Capture the OCR text without retriggering the lookup on every frame.
  const ocrTextRef = useRef(ocrText);
  ocrTextRef.current = ocrText;

  const key = candidate?.key ?? null;

  useEffect(() => {
    if (!candidate || !key || key === activeKey.current) return;
    activeKey.current = key;
    setState((s) => ({ ...s, status: 'searching', candidateKey: key }));

    let cancelled = false;
    lookupCard(candidate, ocrTextRef.current).then((result) => {
      if (cancelled || activeKey.current !== key) return;
      setState({
        status: result ? 'found' : 'not_found',
        result,
        candidateKey: key,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
