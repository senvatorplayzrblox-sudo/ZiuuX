/**
 * Deterministic local blocked-word matching. Plain string operations only (NO user-supplied regex => no ReDoS).
 * Works even when the AI provider is down; fail-open applies to AI classification only.
 */
export type MatchMode = 'word' | 'contains';

export interface BlockedTerm {
  term: string;
  normalized: string;
  matchMode: MatchMode;
}

const COMBINING = /[\u0300-\u036f]/g;
const INVISIBLE = /[\u200b-\u200f\u2060\ufeff\u00ad]/g;

export function normalizeText(input: string): string {
  return input.normalize('NFKC').replace(INVISIBLE, '').normalize('NFD').replace(COMBINING, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Tokens = runs of letters/digits (unicode aware). */
export function tokenize(normalized: string): string[] {
  return normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
}

export interface Matcher {
  find(text: string): BlockedTerm | null;
  readonly size: number;
}

export function compileMatcher(terms: BlockedTerm[]): Matcher {
  const compiled = terms.map((t) => ({ t, tokens: tokenize(t.normalized) })).filter((c) => c.tokens.length > 0 || c.t.normalized.length > 0);
  return {
    size: compiled.length,
    find(text: string): BlockedTerm | null {
      const norm = normalizeText(text);
      if (!norm) return null;
      const tokens = tokenize(norm);
      for (const { t, tokens: tt } of compiled) {
        if (t.matchMode === 'contains') {
          if (norm.includes(t.normalized)) return t;
          continue;
        }
        if (tt.length === 0) continue;
        outer: for (let i = 0; i + tt.length <= tokens.length; i++) {
          for (let j = 0; j < tt.length; j++) if (tokens[i + j] !== tt[j]) continue outer;
          return t;
        }
      }
      return null;
    },
  };
}
