import { AIConfigRepo } from '../database/repositories/index.js';
import {
  CATEGORY_META, normalizeAIConfig, isAIAction, type AIAction, type AICategory, type GuildAIConfig, type Sensitivity, AI_CATEGORIES,
} from '../config/aiCategories.js';
import { AI_LIMITS, CACHE_TTL_MS, LIMITS } from '../config/constants.js';
import { BotError } from '../core/errors/BotError.js';
import { TtlCache } from '../utils/cache.js';

export class AIConfigService {
  private readonly cache = new TtlCache<GuildAIConfig>(CACHE_TTL_MS, 10_000);

  /** Hot path: served from cache; the DB is only read on a miss / after a write. */
  async get(guildId: string): Promise<GuildAIConfig> {
    const hit = this.cache.get(guildId);
    if (hit) return hit;
    const cfg = normalizeAIConfig(guildId, await AIConfigRepo.get(guildId));
    this.cache.set(guildId, cfg);
    return cfg;
  }

  private async patch(guildId: string, set: Record<string, unknown>): Promise<GuildAIConfig> {
    await AIConfigRepo.patch(guildId, set);
    this.cache.delete(guildId);
    return this.get(guildId);
  }

  setEnabled(guildId: string, enabled: boolean) { return this.patch(guildId, { enabled }); }
  setSensitivity(guildId: string, sensitivity: Sensitivity) { return this.patch(guildId, { sensitivity }); }
  setDeleteOnPunish(guildId: string, v: boolean) { return this.patch(guildId, { deleteOnPunish: v }); }

  async setCategoriesEnabled(guildId: string, enabled: readonly AICategory[]) {
    const set = Object.fromEntries(AI_CATEGORIES.map((c) => [`categories.${c}.enabled`, enabled.includes(c)]));
    return this.patch(guildId, set);
  }

  async setThreshold(guildId: string, category: AICategory, value: number) {
    if (!Number.isFinite(value) || value < 0.05 || value > 0.99) throw new BotError('invalid_input', 'Threshold must be a number between 0.05 and 0.99.');
    return this.patch(guildId, { [`categories.${category}.threshold`]: Math.round(value * 100) / 100 });
  }

  async setAction(guildId: string, category: AICategory, action: string) {
    if (CATEGORY_META[category].alertOnly) throw new BotError('invalid_input', 'Self-harm is alert-only and its action cannot be changed.');
    if (!isAIAction(action)) throw new BotError('invalid_input', 'Unknown action.');
    return this.patch(guildId, { [`categories.${category}.action`]: action });
  }

  async setBlockedWordAction(guildId: string, action: string) {
    if (!isAIAction(action)) throw new BotError('invalid_input', 'Unknown action.');
    return this.patch(guildId, { blockedWordAction: action as AIAction });
  }

  async setTimeoutSeconds(guildId: string, seconds: number) {
    if (!Number.isFinite(seconds) || seconds < AI_LIMITS.timeoutSecondsMin || seconds > AI_LIMITS.timeoutSecondsMax) {
      throw new BotError('invalid_input', 'Timeout must be between 1 minute and 24 hours.');
    }
    return this.patch(guildId, { timeoutSeconds: Math.round(seconds) });
  }

  setChannel(guildId: string, kind: 'alert' | 'log', channelId: string | null) {
    return this.patch(guildId, { [kind === 'alert' ? 'alertChannelId' : 'logChannelId']: channelId });
  }

  setScope(guildId: string, ids: string[]) {
    return this.patch(guildId, { scopeChannelIds: [...new Set(ids)].slice(0, LIMITS.scopeChannelsMax) });
  }

  setExemptions(guildId: string, kind: 'roles' | 'channels' | 'users', ids: string[]) {
    const key = { roles: 'exemptRoleIds', channels: 'exemptChannelIds', users: 'exemptUserIds' }[kind];
    return this.patch(guildId, { [key]: [...new Set(ids)].slice(0, LIMITS.exemptionsMax) });
  }
}
