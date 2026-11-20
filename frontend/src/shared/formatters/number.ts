/** Format an optional number using the application's language and fallback. */
export function formatNumber(
  value: number | null | undefined,
  language: string,
  maximumFractionDigits = 3,
  fallback = '—',
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', { maximumFractionDigits });
}
