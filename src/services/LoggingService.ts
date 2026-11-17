import { PermissionFlagsBits, type EmbedBuilder, type Guild, type GuildBasedChannel } from 'discord.js';
import { LogConfigRepo } from '../database/repositories/index.js';
import type { LogConfigDoc } from '../database/models/index.js';
import { CACHE_TTL_MS } from '../config/constants.js';
import { LOG_CATEGORIES, type LogCategory } from '../config/logCategories.js';
import { TtlCache } from '../utils/cache.js';
import { childLogger } from '../utils/logger.js';
import { BotError } from '../core/errors/BotError.js';

const log = childLogger('logging');

export type LogStatus = 'active' | 'disabled' | 'not_configured' | 'channel_missing' | 'missing_permissions';
export interface LogCategoryStatus { category: LogCategory; channelId: string | null; enabled: boolean; status: LogStatus }

const REQUIRED = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];

export class LoggingService {
  private readonly cache = new TtlCache<LogConfigDoc | null>(CACHE_TTL_MS, 5000);

  async getConfig(guildId: string): Promise<LogConfigDoc | null> {
    const hit = this.cache.get(guildId);
    if (hit !== undefined) return hit;
    const doc = await LogConfigRepo.get(guildId);
    this.cache.set(guildId, doc);
    return doc;
  }

  /** Cheap pre-check used by event handlers to avoid doing work (audit-log fetches) for unconfigured categories. */
  async isConfigured(guildId: string, category: LogCategory): Promise<boolean> {
    const e = (await this.getConfig(guildId))?.channels?.[category];
    return !!e && e.enabled && !!e.channelId;
  }

  private botCanPost(guild: Guild, channel: GuildBasedChannel): boolean {
    const me = guild.members.me;
    if (!me || !channel.isTextBased()) return false;
    const perms = channel.permissionsFor(me);
    return !!perms && REQUIRED.every((p) => perms.has(p));
  }

  /** Never throws: a logging failure must never break the originating action. */
  async send(guild: Guild, category: LogCategory, embed: EmbedBuilder): Promise<boolean> {
    try {
      const entry = (await this.getConfig(guild.id))?.channels?.[category];
      if (!entry || !entry.enabled || !entry.channelId) return false;
      return await this.sendToChannel(guild, entry.channelId, embed);
    } catch (err) {
      log.warn({ err, guildId: guild.id, category }, 'log send failed');
      return false;
    }
  }

  /** Posts to an explicit channel (used by the AI incident/alert channels). Never throws. */
  async sendToChannel(guild: Guild, channelId: string, embed: EmbedBuilder): Promise<boolean> {
    try {
      const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel || !channel.isTextBased() || !this.botCanPost(guild, channel)) return false;
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      return true;
    } catch (err) {
      log.warn({ err, guildId: guild.id, channelId }, 'channel send failed');
      return false;
    }
  }

  assertChannelUsable(guild: Guild, channel: GuildBasedChannel): void {
    if (!channel.isTextBased() || channel.isThread() || channel.isVoiceBased()) throw new BotError('invalid_input', 'Please choose a text or announcement channel.');
    if (!this.botCanPost(guild, channel)) {
      throw new BotError('bot_permission', `I need **View Channel**, **Send Messages** and **Embed Links** in <#${channel.id}>.`);
    }
  }

  async setChannel(guild: Guild, categories: readonly LogCategory[], channel: GuildBasedChannel): Promise<void> {
    this.assertChannelUsable(guild, channel);
    await LogConfigRepo.setMany(guild.id, categories, { channelId: channel.id, enabled: true });
    this.cache.delete(guild.id);
  }

  async setEnabled(guildId: string, category: LogCategory, enabled: boolean): Promise<void> {
    const entry = (await LogConfigRepo.get(guildId))?.channels?.[category];
    if (enabled && !entry?.channelId) throw new BotError('invalid_input', 'No channel is configured for that category yet. Use `/setlogs set` first.');
    await LogConfigRepo.setCategory(guildId, category, { channelId: entry?.channelId ?? null, enabled });
    this.cache.delete(guildId);
  }

  async clear(guildId: string, category: LogCategory): Promise<void> {
    await LogConfigRepo.setCategory(guildId, category, { channelId: null, enabled: false });
    this.cache.delete(guildId);
  }

  async status(guild: Guild): Promise<LogCategoryStatus[]> {
    const cfg = await LogConfigRepo.get(guild.id); // fresh read: this is a diagnostic view
    this.cache.set(guild.id, cfg);
    const out: LogCategoryStatus[] = [];
    for (const category of LOG_CATEGORIES) {
      const e = cfg?.channels?.[category];
      const channelId = e?.channelId ?? null;
      let status: LogStatus;
      if (!channelId) status = 'not_configured';
      else if (!e?.enabled) status = 'disabled';
      else {
        const ch = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
        status = !ch ? 'channel_missing' : this.botCanPost(guild, ch) ? 'active' : 'missing_permissions';
      }
      out.push({ category, channelId, enabled: e?.enabled === true, status });
    }
    return out;
  }
}
