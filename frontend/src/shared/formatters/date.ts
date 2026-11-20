const FACTORY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Format the current factory date and time for operator-facing timestamps. */
export function currentFactoryDateTime(): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: FACTORY_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
}

/** Return today's date in the factory timezone using an ISO-compatible format. */
export function factoryToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FACTORY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Format a date-only value according to the active application language. */
export function formatDateOnly(value: string, language: string): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB');
}
