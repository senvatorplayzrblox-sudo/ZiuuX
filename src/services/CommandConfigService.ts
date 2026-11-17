import { CommandConfigRepo } from '../database/repositories/index.js';
import { isConfigurableKey, type CommandKey } from '../config/commandKeys.js';
import { CACHE_TTL_MS, LIMITS } from '../config/constants.js';
import { BotError } from '../core/errors/BotError.js';
import { evaluateCommandAccess, type CommandRule } from '../permissions/accessRules.js';
import { TtlCache } from '../utils/cache.js';

export class CommandConfigService {
  private readonly cache = new TtlCache<Map<string, CommandRule>>(CACHE_TTL_MS, 5000);

  async rules(guildId: string): Promise<Map<string, CommandRule>> {
    const hit = this.cache.get(guildId);
    if (hit) return hit;
    const docs = await CommandConfigRepo.list(guildId);
    const map = new Map<string, CommandRule>(
      docs.map((d) => [d.commandKey, { commandKey: d.commandKey, enabled: d.enabled !== false, roleIds: d.roleIds ?? [], channelIds: d.channelIds ?? [] }]),
    );
    this.cache.set(guildId, map);
    return map;
  }

  /** Throws a BotError if /cmdconfig forbids this use. Called by the command pipeline AND by every panel action. */
  async assertAllowed(guildId: string, key: CommandKey, memberRoleIds: readonly string[], channelIds: readonly string[]): Promise<void> {
    const rules = await this.rules(guildId);
    const r = evaluateCommandAccess(key, rules.get(key), memberRoleIds, channelIds);
    if (!r.allowed) throw new BotError(r.code, r.message);
  }

  async get(guildId: string, key: CommandKey): Promise<CommandRule> {
    return (await this.rules(guildId)).get(key) ?? { commandKey: key, enabled: true, roleIds: [], channelIds: [] };
  }

  private assertKey(key: string): asserts key is CommandKey {
    if (!isConfigurableKey(key)) throw new BotError('invalid_input', 'That command cannot be configured.');
  }

  async setEnabled(guildId: string, key: string, enabled: boolean, by: string): Promise<void> {
    this.assertKey(key);
    await CommandConfigRepo.patch(guildId, key, { enabled }, by);
    this.cache.delete(guildId);
  }

  async setRoles(guildId: string, key: string, roleIds: string[], by: string): Promise<void> {
    this.assertKey(key);
    await CommandConfigRepo.patch(guildId, key, { roleIds: [...new Set(roleIds)].slice(0, LIMITS.exemptionsMax) }, by);
    this.cache.delete(guildId);
  }

  async setChannels(guildId: string, key: string, channelIds: string[], by: string): Promise<void> {
    this.assertKey(key);
    await CommandConfigRepo.patch(guildId, key, { channelIds: [...new Set(channelIds)].slice(0, LIMITS.exemptionsMax) }, by);
    this.cache.delete(guildId);
  }

  async reset(guildId: string, key: string): Promise<void> {
    this.assertKey(key);
    await CommandConfigRepo.delete(guildId, key);
    this.cache.delete(guildId);
  }

  async resetAll(guildId: string): Promise<void> {
    await CommandConfigRepo.deleteGuildData(guildId);
    this.cache.delete(guildId);
  }

  /** Commands with any non-default setting, for the overview. */
  async customized(guildId: string): Promise<CommandRule[]> {
    return [...(await this.rules(guildId)).values()].filter((r) => !r.enabled || r.roleIds.length > 0 || r.channelIds.length > 0);
  }
}
