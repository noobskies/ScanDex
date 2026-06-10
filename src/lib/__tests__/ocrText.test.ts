import { extractOcrText } from '../ocrText';

describe('extractOcrText', () => {
  it('passes strings through', () => {
    expect(extractOcrText('025/198')).toBe('025/198');
  });

  it('reads resultText from a single object', () => {
    expect(extractOcrText({ resultText: 'Pikachu' })).toBe('Pikachu');
  });

  it('joins arrays of results', () => {
    expect(
      extractOcrText([{ resultText: 'Pikachu' }, { resultText: '025/198' }]),
    ).toBe('Pikachu\n025/198');
  });

  it('returns an empty string for junk', () => {
    expect(extractOcrText(null)).toBe('');
    expect(extractOcrText(undefined)).toBe('');
    expect(extractOcrText(42)).toBe('');
    expect(extractOcrText({})).toBe('');
  });
});
