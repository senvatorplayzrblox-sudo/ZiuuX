import { BlockedWordRepo } from '../database/repositories/index.js';
import type { BlockedWordDoc } from '../database/models/index.js';
import { compileMatcher, normalizeText, type Matcher, type MatchMode } from '../ai/blockedWords.js';
import { CACHE_TTL_MS, LIMITS } from '../config/constants.js';
import { BotError } from '../core/errors/BotError.js';
import { TtlCache } from '../utils/cache.js';

export class BlockedWordService {
  private readonly cache = new TtlCache<Matcher>(CACHE_TTL_MS, 5000);

  async matcher(guildId: string): Promise<Matcher> {
    const hit = this.cache.get(guildId);
    if (hit) return hit;
    const m = compileMatcher((await BlockedWordRepo.list(guildId)).map((d) => ({ term: d.term, normalized: d.normalized, matchMode: d.matchMode })));
    this.cache.set(guildId, m);
    return m;
  }

  list(guildId: string): Promise<BlockedWordDoc[]> {
    return BlockedWordRepo.list(guildId);
  }

  async add(guildId: string, rawTerms: string[], mode: MatchMode, by: string): Promise<{ added: number; duplicates: number; rejected: number; limitReached: boolean }> {
    let added = 0, duplicates = 0, rejected = 0, limitReached = false;
    let count = await BlockedWordRepo.count(guildId);
    for (const raw of rawTerms) {
      const term = raw.trim();
      const normalized = normalizeText(term);
      if (!term || !normalized || term.length > LIMITS.blockedWordMaxLen) { rejected++; continue; }
      if (count >= LIMITS.blockedWordsMax) { limitReached = true; rejected++; continue; }
      if (await BlockedWordRepo.add(guildId, { term, normalized, matchMode: mode, addedBy: by })) { added++; count++; } else duplicates++;
    }
    this.cache.delete(guildId);
    if (added === 0 && duplicates === 0 && rejected > 0 && limitReached) throw new BotError('invalid_input', `The blocked word limit (${LIMITS.blockedWordsMax}) has been reached.`);
    return { added, duplicates, rejected, limitReached };
  }

  async remove(guildId: string, normalized: string): Promise<boolean> {
    const ok = await BlockedWordRepo.remove(guildId, normalized);
    this.cache.delete(guildId);
    return ok;
  }
}
