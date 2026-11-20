import { describe, expect, it } from 'vitest';
import { formatNumber } from './number';

describe('formatNumber', () => {
  it('formats Vietnamese decimal values consistently', () => {
    expect(formatNumber(9124.5, 'vi', 1)).toBe('9.124,5');
  });

  it('uses the fallback for missing or invalid values', () => {
    expect(formatNumber(null, 'vi')).toBe('—');
    expect(formatNumber(Number.NaN, 'vi')).toBe('—');
  });
});
