import { describe, expect, it } from 'vitest';
import { formatDateOnly } from './date';

describe('formatDateOnly', () => {
  it('formats a valid date according to the selected language', () => {
    expect(formatDateOnly('2026-11-19', 'vi')).toBe('19/11/2026');
    expect(formatDateOnly('2026-11-19', 'en')).toBe('19/11/2026');
  });

  it('keeps invalid input visible instead of throwing', () => {
    expect(formatDateOnly('not-a-date', 'vi')).toBe('not-a-date');
    expect(formatDateOnly('', 'vi')).toBe('—');
  });
});
