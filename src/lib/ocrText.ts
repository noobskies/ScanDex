/**
 * Normalizes output from the vision-camera ML Kit text-recognition plugin
 * into a single string. The plugin's shape varies between an array of result
 * objects, a single object, or occasionally a bare string, so be liberal in
 * what we accept.
 */

interface MaybeOcrResult {
  resultText?: unknown;
}

export function extractOcrText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map(extractOcrText).join('\n');
  if (data && typeof data === 'object') {
    const { resultText } = data as MaybeOcrResult;
    if (typeof resultText === 'string') return resultText;
  }
  return '';
}
