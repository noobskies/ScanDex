import { ScanStabilizer } from '../scanStabilizer';

describe('ScanStabilizer', () => {
  it('stays null until a key reaches the vote threshold', () => {
    const s = new ScanStabilizer({ threshold: 3 });
    expect(s.observe('a', 0)).toBeNull();
    expect(s.observe('a', 100)).toBeNull();
    expect(s.observe('a', 200)).toBe('a');
  });

  it('is not fooled by alternating noise', () => {
    const s = new ScanStabilizer({ threshold: 3 });
    expect(s.observe('a', 0)).toBeNull();
    expect(s.observe('b', 100)).toBeNull();
    expect(s.observe('a', 200)).toBeNull();
    expect(s.observe('b', 300)).toBeNull();
    expect(s.observe('a', 400)).toBe('a');
  });

  it('keeps the stable key through empty frames', () => {
    const s = new ScanStabilizer({ threshold: 3 });
    s.observe('a', 0);
    s.observe('a', 100);
    s.observe('a', 200);
    expect(s.observe(null, 300)).toBe('a');
  });

  it('switches to a new majority', () => {
    const s = new ScanStabilizer({ windowSize: 5, threshold: 3 });
    for (const t of [0, 100, 200]) s.observe('a', t);
    s.observe('b', 300);
    s.observe('b', 400);
    expect(s.observe('b', 500)).toBe('b');
  });

  it('forgets observations older than maxAgeMs', () => {
    const s = new ScanStabilizer({ threshold: 3, maxAgeMs: 1000 });
    s.observe('a', 0);
    s.observe('a', 100);
    // The first two observations have expired by now.
    expect(s.observe('a', 5000)).toBeNull();
  });

  it('clears the stable key once everything expires', () => {
    const s = new ScanStabilizer({ threshold: 2, maxAgeMs: 1000 });
    s.observe('a', 0);
    expect(s.observe('a', 100)).toBe('a');
    expect(s.observe(null, 5000)).toBeNull();
  });
});
