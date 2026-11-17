import { ButtonStyle } from 'discord.js';
import { button } from './builders.js';
import type { ButtonBuilder } from 'discord.js';

export interface Page<T> { items: T[]; page: number; pages: number; total: number }

export function paginate<T>(all: readonly T[], page: number, size: number): Page<T> {
  const pages = Math.max(1, Math.ceil(all.length / size));
  const p = Math.min(Math.max(0, Math.trunc(page) || 0), pages - 1);
  return { items: all.slice(p * size, p * size + size), page: p, pages, total: all.length };
}

/**
 * Previous / indicator / next buttons. `idFor(n)` builds the custom id for page n.
 * Discord rejects duplicate custom ids within one message, so disabled buttons get unique placeholder ids.
 */
export function pageButtons(page: number, pages: number, idFor: (n: number) => string): ButtonBuilder[] {
  const hasPrev = page > 0;
  const hasNext = page < pages - 1;
  return [
    button(hasPrev ? idFor(page - 1) : 'zx:noop:prev', 'Previous', ButtonStyle.Secondary, 'back', !hasPrev),
    button('zx:noop:page', `${page + 1} / ${pages}`, ButtonStyle.Secondary, undefined, true),
    button(hasNext ? idFor(page + 1) : 'zx:noop:next', 'Next', ButtonStyle.Secondary, undefined, !hasNext),
  ];
}
