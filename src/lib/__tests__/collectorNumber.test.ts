import { parseCollectorNumber } from '../collectorNumber';

describe('parseCollectorNumber', () => {
  it('parses a plain modern fraction', () => {
    const [c] = parseCollectorNumber('Pikachu ex\nHP 200\n025/198');
    expect(c).toMatchObject({ localId: '025', printedTotal: 198, key: '25/198' });
  });

  it('parses a vintage fraction', () => {
    const [c] = parseCollectorNumber('Charizard 4/102');
    expect(c).toMatchObject({ localId: '4', printedTotal: 102 });
  });

  it('parses secret rares above the printed total', () => {
    const [c] = parseCollectorNumber('194/182');
    expect(c).toMatchObject({ localId: '194', printedTotal: 182 });
  });

  it('parses Trainer Gallery numbering', () => {
    const [c] = parseCollectorNumber('TG12/TG30');
    expect(c).toMatchObject({ localId: 'TG12', printedTotal: 30, key: 'TG12/TG30' });
  });

  it('parses Galarian Gallery numbering', () => {
    const [c] = parseCollectorNumber('GG23/GG70');
    expect(c).toMatchObject({ localId: 'GG23', printedTotal: 70 });
  });

  it('parses Shiny Vault numbering with zero padding', () => {
    const [c] = parseCollectorNumber('SV049/SV122');
    expect(c).toMatchObject({ localId: 'SV049', printedTotal: 122 });
  });

  it('tolerates OCR dropping one prefix', () => {
    const [c] = parseCollectorNumber('TG12/30');
    expect(c).toMatchObject({ localId: 'TG12', printedTotal: 30 });
  });

  it('rejects mismatched prefixes', () => {
    expect(parseCollectorNumber('TG12/GG30')).toHaveLength(0);
  });

  it('repairs common OCR digit confusions', () => {
    const [c] = parseCollectorNumber('O25/I98');
    expect(c).toMatchObject({ localId: '025', printedTotal: 198 });
  });

  it('attaches the SV-era set code when present', () => {
    const [c] = parseCollectorNumber('Sprigatito\n025/198\nPAL EN');
    expect(c).toMatchObject({ setCode: 'PAL', key: 'PAL:25/198' });
  });

  it('parses SWSH promo numbers', () => {
    const [c] = parseCollectorNumber('Pikachu V\nSWSH039');
    expect(c).toMatchObject({ localId: 'SWSH039', key: 'SWSH039' });
  });

  it('prefers fractions over promo-pattern noise', () => {
    const cards = parseCollectorNumber('SWSH039 but also 025/198');
    expect(cards[0].printedTotal).toBe(198);
    expect(cards).toHaveLength(1);
  });

  it('ignores small fractions that are probably damage text', () => {
    expect(parseCollectorNumber('does 1/2 damage')).toHaveLength(0);
  });

  it('returns nothing for text without identifiers', () => {
    expect(parseCollectorNumber('Basic Pokémon HP 60 Tackle 10')).toHaveLength(0);
  });

  it('de-duplicates repeated matches', () => {
    expect(parseCollectorNumber('025/198 ... 025/198')).toHaveLength(1);
  });
});
