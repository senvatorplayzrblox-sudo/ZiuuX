import type { Guild, GuildMember, GuildTextBasedChannel, TextChannel, User, EmbedBuilder } from 'discord.js';
import { LIMITS } from '../config/constants.js';
import { BotError } from '../core/errors/BotError.js';
import type { PermissionService } from '../permissions/PermissionService.js';
import type { CaseDoc, CaseSource, CaseType } from '../types/moderation.js';
import { caseEmbed, dmEmbed } from '../ui/embeds/case.js';
import { cleanReason, truncate } from '../utils/text.js';
import { childLogger } from '../utils/logger.js';
import type { ActionMarkers } from './ActionMarkers.js';
import type { CaseService } from './CaseService.js';
import type { LockService, LockableChannel } from './LockService.js';
import type { LoggingService } from './LoggingService.js';
import type { WarningService } from './WarningService.js';

const log = childLogger('moderation');

export interface ModContext {
  guild: Guild;
  actor: GuildMember;
  reason?: string | null;
  source?: CaseSource;
  /** Extra case metadata (e.g. AI category). */
  metadata?: Record<string, unknown>;
}
export interface ModResult { case: CaseDoc; dmDelivered: boolean | null; note?: string | null }

/**
 * Single choke point for every moderation action (slash commands, staff panel, AI).
 * Each method: (1) authorises via PermissionService (Discord perms + hierarchy, no owner bypass),
 * (2) performs the Discord action, (3) persists a case, (4) notifies the moderation log.
 */
export class ModerationService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly cases: CaseService,
    private readonly warnings: WarningService,
    private readonly locks: LockService,
    private readonly logging: LoggingService,
    private readonly markers: ActionMarkers,
  ) {}

  // ----- helpers -----
  private async bot(guild: Guild): Promise<GuildMember> {
    return guild.members.me ?? (await guild.members.fetchMe());
  }
  private auditReason(ctx: ModContext, reason: string | null): string {
    return truncate(`${ctx.actor.user.tag} (${ctx.actor.id})${reason ? `: ${reason}` : ''}`, LIMITS.reasonMax);
  }
  private async dm(user: User, embed: EmbedBuilder): Promise<boolean> {
    try {
      await user.send({ embeds: [embed] });
      return true;
    } catch {
      return false; // DMs closed / blocked: non-fatal, recorded on the case
    }
  }
  private src(ctx: ModContext): CaseSource {
    return ctx.source ?? 'manual';
  }
  private async finish(ctx: ModContext, c: CaseDoc): Promise<void> {
    await this.logging.send(ctx.guild, 'moderation', caseEmbed(c));
  }
  private async assertMember(ctx: ModContext, target: GuildMember, action: Parameters<PermissionService['assertModeration']>[0]['action']): Promise<GuildMember> {
    this.permissions.assertModeration({ guild: ctx.guild, actor: ctx.actor, bot: await this.bot(ctx.guild), target, action });
    return target;
  }
  private base(ctx: ModContext, type: CaseType, targetId: string | null, reason: string | null, extra: Record<string, unknown> = {}, dm: boolean | null = null) {
    return { guildId: ctx.guild.id, type, targetId, moderatorId: ctx.actor.id, reason, source: this.src(ctx), metadata: { ...(ctx.metadata ?? {}), ...extra }, dmDelivered: dm };
  }

  // ----- user actions -----
  async warn(ctx: ModContext, target: GuildMember): Promise<ModResult> {
    await this.assertMember(ctx, target, 'warn');
    const reason = cleanReason(ctx.reason);
    const dm = await this.dm(target.user, dmEmbed({ guildName: ctx.guild.name, type: 'warn', reason }));
    const c = await this.warnings.addWarning({ guildId: ctx.guild.id, userId: target.id, moderatorId: ctx.actor.id, reason, source: this.src(ctx), dmDelivered: dm, metadata: ctx.metadata });
    await this.finish(ctx, c);
    return { case: c, dmDelivered: dm };
  }

  async timeout(ctx: ModContext, target: GuildMember, durationMs: number): Promise<ModResult> {
    if (!Number.isFinite(durationMs) || durationMs < LIMITS.timeoutMinMs || durationMs > LIMITS.timeoutMaxMs) {
      throw new BotError('invalid_input', 'Timeout duration must be between 5 seconds and 28 days.');
    }
    await this.assertMember(ctx, target, 'timeout');
    const reason = cleanReason(ctx.reason);
    this.markers.mark(ctx.guild.id, 'timeout', target.id, { moderatorId: ctx.actor.id, reason });
    await target.timeout(durationMs, this.auditReason(ctx, reason));
    const dm = await this.dm(target.user, dmEmbed({ guildName: ctx.guild.name, type: 'timeout', reason, durationMs }));
    const c = await this.cases.record(this.base(ctx, 'timeout', target.id, reason, { durationMs, until: new Date(Date.now() + durationMs).toISOString() }, dm));
    this.markers.update(ctx.guild.id, 'timeout', target.id, { caseNumber: c.caseNumber });
    await this.finish(ctx, c);
    return { case: c, dmDelivered: dm };
  }

  async untimeout(ctx: ModContext, target: GuildMember): Promise<ModResult> {
    await this.assertMember(ctx, target, 'untimeout');
    if (!target.isCommunicationDisabled()) throw new BotError('already_done', 'That member is not timed out.');
    const reason = cleanReason(ctx.reason);
    this.markers.mark(ctx.guild.id, 'timeout', target.id, { moderatorId: ctx.actor.id, reason });
    await target.timeout(null, this.auditReason(ctx, reason));
    const c = await this.cases.record(this.base(ctx, 'untimeout', target.id, reason));
    this.markers.update(ctx.guild.id, 'timeout', target.id, { caseNumber: c.caseNumber });
    await this.finish(ctx, c);
    return { case: c, dmDelivered: null };
  }

  async kick(ctx: ModContext, target: GuildMember): Promise<ModResult> {
    await this.assertMember(ctx, target, 'kick');
    const reason = cleanReason(ctx.reason);
    const dm = await this.dm(target.user, dmEmbed({ guildName: ctx.guild.name, type: 'kick', reason })); // must precede the kick
    await target.kick(this.auditReason(ctx, reason));
    const c = await this.cases.record(this.base(ctx, 'kick', target.id, reason, {}, dm));
    await this.finish(ctx, c);
    return { case: c, dmDelivered: dm };
  }

  /** Permanent ban (no temp bans in v1). Works for non-members via user ID. */
  async ban(ctx: ModContext, user: User, deleteDays = 0): Promise<ModResult> {
    const days = Math.min(LIMITS.banDeleteDaysMax, Math.max(0, Math.trunc(deleteDays)));
    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    this.permissions.assertModeration({ guild: ctx.guild, actor: ctx.actor, bot: await this.bot(ctx.guild), target: member ?? { id: user.id }, action: 'ban' });
    if (await ctx.guild.bans.fetch(user.id).catch(() => null)) throw new BotError('already_done', 'That user is already banned.');
    const reason = cleanReason(ctx.reason);
    const dm = member ? await this.dm(user, dmEmbed({ guildName: ctx.guild.name, type: 'ban', reason })) : false;
    this.markers.mark(ctx.guild.id, 'ban', user.id, { moderatorId: ctx.actor.id, reason });
    await ctx.guild.members.ban(user.id, { reason: this.auditReason(ctx, reason), deleteMessageSeconds: days * 86_400 });
    const c = await this.cases.record(this.base(ctx, 'ban', user.id, reason, { deleteDays: days }, member ? dm : null));
    this.markers.update(ctx.guild.id, 'ban', user.id, { caseNumber: c.caseNumber });
    await this.finish(ctx, c);
    return { case: c, dmDelivered: member ? dm : null };
  }

  async unban(ctx: ModContext, userId: string): Promise<ModResult> {
    this.permissions.assertModeration({ guild: ctx.guild, actor: ctx.actor, bot: await this.bot(ctx.guild), target: { id: userId }, action: 'unban' });
    const ban = await ctx.guild.bans.fetch(userId).catch(() => null);
    if (!ban) throw new BotError('not_found', 'That user is not banned.');
    const reason = cleanReason(ctx.reason);
    this.markers.mark(ctx.guild.id, 'unban', userId, { moderatorId: ctx.actor.id, reason });
    await ctx.guild.members.unban(userId, this.auditReason(ctx, reason));
    const c = await this.cases.record(this.base(ctx, 'unban', userId, reason));
    this.markers.update(ctx.guild.id, 'unban', userId, { caseNumber: c.caseNumber });
    await this.finish(ctx, c);
    return { case: c, dmDelivered: null };
  }

  // ----- warnings -----
  async removeWarning(ctx: ModContext, caseNumber: number): Promise<ModResult & { userId: string }> {
    this.permissions.assertModeration({ guild: ctx.guild, actor: ctx.actor, bot: await this.bot(ctx.guild), target: null, action: 'removewarn' });
    const { case: c, warning } = await this.warnings.removeWarning({ guildId: ctx.guild.id, caseNumber, moderatorId: ctx.actor.id, reason: cleanReason(ctx.reason), source: this.src(ctx) });
    await this.finish(ctx, c);
    return { case: c, dmDelivered: null, userId: warning.userId };
  }

  async clearWarnings(ctx: ModContext, user: User): Promise<ModResult & { cleared: number }> {
    this.permissions.assertModeration({ guild: ctx.guild, actor: ctx.actor, bot: await this.bot(ctx.guild), target: null, action: 'clearwarnings' });
    const { case: c, cleared } = await this.warnings.clearWarnings({ guildId: ctx.guild.id, userId: user.id, moderatorId: ctx.actor.id, reason: cleanReason(ctx.reason), source: this.src(ctx) });
    await this.finish(ctx, c);
    return { case: c, dmDelivered: null, cleared };
  }

  // ----- channel actions -----
  private async assertChannel(ctx: ModContext, channel: Parameters<PermissionService['assertChannelAction']>[0]['channel'], action: Parameters<PermissionService['assertChannelAction']>[0]['action']): Promise<void> {
    this.permissions.assertChannelAction({ actor: ctx.actor, bot: await this.bot(ctx.guild), channel, action });
  }

  async purge(ctx: ModContext, channel: GuildTextBasedChannel, amount: number, userId?: string | null): Promise<ModResult & { deleted: number }> {
    if (!Number.isInteger(amount) || amount < 1 || amount > LIMITS.purgeMax) throw new BotError('invalid_input', `Amount must be between 1 and ${LIMITS.purgeMax}.`);
    if (!('bulkDelete' in channel)) throw new BotError('invalid_input', 'Messages cannot be bulk-deleted in this channel type.');
    await this.assertChannel(ctx, channel, 'purge');
    const cutoff = Date.now() - 14 * 86_400_000 + 60_000; // Discord cannot bulk-delete messages older than 14 days
    const fetched = await channel.messages.fetch({ limit: 100 });
    let msgs = [...fetched.values()].filter((m) => m.createdTimestamp > cutoff);
    if (userId) msgs = msgs.filter((m) => m.author.id === userId);
    msgs = msgs.slice(0, amount);
    if (msgs.length === 0) throw new BotError('not_found', 'There are no deletable messages matching that filter (messages older than 14 days cannot be bulk-deleted).');
    this.markers.mark(ctx.guild.id, 'purge', channel.id, { moderatorId: ctx.actor.id, reason: cleanReason(ctx.reason) });
    const deleted = (await channel.bulkDelete(msgs, true)).size;
    const reason = cleanReason(ctx.reason);
    const c = await this.cases.record(this.base(ctx, 'purge', userId ?? null, reason, { channelId: channel.id, requested: amount, deleted }));
    await this.finish(ctx, c);
    return { case: c, dmDelivered: null, deleted };
  }

  async lock(ctx: ModContext, channel: LockableChannel): Promise<ModResult> {
    await this.assertChannel(ctx, channel, 'lock');
    const reason = cleanReason(ctx.reason);
    await this.locks.lock(channel, ctx.actor.id, this.auditReason(ctx, reason));
    const c = await this.cases.record(this.base(ctx, 'lock', null, reason, { channelId: channel.id }));
    await this.finish(ctx, c);
    return { case: c, dmDelivered: null };
  }

  async unlock(ctx: ModContext, channel: LockableChannel): Promise<ModResult> {
    await this.assertChannel(ctx, channel, 'unlock');
    const reason = cleanReason(ctx.reason);
    const { note } = await this.locks.unlock(channel, this.auditReason(ctx, reason));
    const c = await this.cases.record(this.base(ctx, 'unlock', null, reason, { channelId: channel.id }));
    await this.finish(ctx, c);
    return { case: c, dmDelivered: null, note };
  }

  async slowmode(ctx: ModContext, channel: TextChannel, seconds: number): Promise<ModResult> {
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > LIMITS.slowmodeMaxSeconds) throw new BotError('invalid_input', `Slowmode must be between 0 and ${LIMITS.slowmodeMaxSeconds} seconds.`);
    await this.assertChannel(ctx, channel, 'slowmode');
    const previous = channel.rateLimitPerUser;
    const reason = cleanReason(ctx.reason);
    await channel.setRateLimitPerUser(seconds, this.auditReason(ctx, reason));
    const c = await this.cases.record(this.base(ctx, 'slowmode', null, reason, { channelId: channel.id, seconds, previous }));
    await this.finish(ctx, c);
    return { case: c, dmDelivered: null };
  }
}

void log;
