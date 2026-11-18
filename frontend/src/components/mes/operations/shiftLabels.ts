export const shiftOptions = [
  { value: 'CA A', vi: 'Ca A', en: 'Shift A' },
  { value: 'CA B', vi: 'Ca B', en: 'Shift B' },
  { value: 'CA C', vi: 'Ca C', en: 'Shift C' },
  { value: 'HÀNH CHÍNH', vi: 'Hành chính', en: 'Administrative' },
] as const;

/** Convert a human-entered shift value into the WS3 canonical shift code. */
export function normalizeShift(value?: string | null): string {
  const normalized = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

  if (['CA A', 'SHIFT A', 'A'].includes(normalized)) return 'CA A';
  if (['CA B', 'SHIFT B', 'B'].includes(normalized)) return 'CA B';
  if (['CA C', 'SHIFT C', 'C'].includes(normalized)) return 'CA C';
  if (['HANH CHINH', 'ADMINISTRATIVE', 'ADMIN'].includes(normalized)) return 'HÀNH CHÍNH';
  return '';
}

/** Format a canonical shift value for the current UI language. */
export function formatShiftLabel(value?: string | null, language: string = 'vi'): string {
  const normalized = normalizeShift(value);
  if (!normalized) return value?.trim() ?? '';
  if (language !== 'vi') {
    if (normalized === 'CA A') return 'Shift A';
    if (normalized === 'CA B') return 'Shift B';
    if (normalized === 'CA C') return 'Shift C';
    return 'Administrative';
  }
  if (normalized === 'CA A') return 'Ca A';
  if (normalized === 'CA B') return 'Ca B';
  if (normalized === 'CA C') return 'Ca C';
  return 'Hành chính';
}
