const UNIT_MS: Record<string, number> = {
  w: 7 * 24 * 3600_000,
  d: 24 * 3600_000,
  h: 3600_000,
  m: 60_000,
  s: 1000,
};

/**
 * Parses "90m", "2h", "1d12h", "1w". Units are REQUIRED (a bare number is ambiguous).
 * Returns milliseconds, or null if the input is not a valid duration.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  const re = /(\d+)([wdhms])/g;
  let total = 0;
  let consumed = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index !== consumed) return null;
    consumed += m[0].length;
    const unit = UNIT_MS[m[2] as string];
    if (unit === undefined) return null;
    total += Number(m[1]) * unit;
    if (!Number.isSafeInteger(total)) return null;
  }
  if (consumed !== s.length || total <= 0) return null;
  return total;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const parts: string[] = [];
  let rest = Math.round(ms / 1000);
  for (const [label, secs] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]] as const) {
    const n = Math.floor(rest / secs);
    if (n > 0) {
      parts.push(`${n}${label}`);
      rest -= n * secs;
    }
  }
  return parts.join(' ') || '0s';
}
