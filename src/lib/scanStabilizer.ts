/**
 * Multi-frame voting for scan results.
 *
 * Holo foil glare and motion blur make single-frame OCR unreliable, so a
 * candidate only becomes "stable" once it wins a majority of recent frames.
 */

export interface StabilizerOptions {
  /** Number of recent observations to keep. */
  windowSize?: number;
  /** Votes within the window required to declare a winner. */
  threshold?: number;
  /** Observations older than this are dropped (ms). */
  maxAgeMs?: number;
}

export class ScanStabilizer {
  private readonly windowSize: number;
  private readonly threshold: number;
  private readonly maxAgeMs: number;
  private observations: { key: string; at: number }[] = [];
  private stableKey: string | null = null;

  constructor(options: StabilizerOptions = {}) {
    this.windowSize = options.windowSize ?? 8;
    this.threshold = options.threshold ?? 3;
    this.maxAgeMs = options.maxAgeMs ?? 3000;
  }

  /**
   * Records one frame's best candidate key (or null when the frame produced
   * nothing) and returns the currently stable key, if any.
   */
  observe(key: string | null, now: number = Date.now()): string | null {
    this.observations = this.observations
      .filter((o) => now - o.at <= this.maxAgeMs)
      .slice(-(this.windowSize - 1));
    if (key !== null) {
      this.observations.push({ key, at: now });
    }

    const votes = new Map<string, number>();
    for (const o of this.observations) {
      votes.set(o.key, (votes.get(o.key) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestVotes = 0;
    for (const [k, v] of votes) {
      if (v > bestVotes) {
        best = k;
        bestVotes = v;
      }
    }
    if (best !== null && bestVotes >= this.threshold) {
      this.stableKey = best;
    } else if (this.observations.length === 0) {
      this.stableKey = null;
    }
    return this.stableKey;
  }

  reset(): void {
    this.observations = [];
    this.stableKey = null;
  }
}
