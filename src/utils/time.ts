export type TimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

export function ts(date: Date | number | null | undefined, style: TimestampStyle = 'f'): string {
  if (date === null || date === undefined) return 'unknown';
  const ms = date instanceof Date ? date.getTime() : date;
  if (!Number.isFinite(ms)) return 'unknown';
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

export function tsBoth(date: Date | number | null | undefined): string {
  return `${ts(date, 'F')} (${ts(date, 'R')})`;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
