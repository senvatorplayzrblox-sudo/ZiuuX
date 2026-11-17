import type { Guild, GuildMember, GuildBasedChannel } from 'discord.js';
import { BotError } from '../core/errors/BotError.js';
import { evaluateChannelAction, evaluateModeration, DENY_MESSAGES, type PermissionResult } from './hierarchy.js';
import { ACTOR_PERMS, BOT_PERMS, TARGETED_ACTIONS, type ModAction } from './policy.js';
import { hasAllPerms, memberPrincipal, userPrincipal } from './discordPerms.js';

export interface ModerationCheck {
  guild: Guild;
  actor: GuildMember;
  bot: GuildMember;
  /** A GuildMember (hierarchy applies) or a bare user id for non-members (ban/unban by ID). */
  target: GuildMember | { id: string } | null;
  action: ModAction;
}

/**
 * Moderation authorisation. By design this class has NO knowledge of the ZiuuX bot owner:
 * the owner is treated exactly like any other user. Never add an owner exception here.
 */
export class PermissionService {
  checkModeration(i: ModerationCheck): PermissionResult {
    const targeted = TARGETED_ACTIONS.includes(i.action) && i.target !== null;
    let target = null;
    let platformManageable: boolean | null = null;
    if (targeted && i.target) {
      if ('roles' in i.target) {
        target = memberPrincipal(i.guild, i.target);
        if (i.action === 'kick') platformManageable = i.target.kickable;
        else if (i.action === 'ban') platformManageable = i.target.bannable;
        else if (i.action === 'timeout' || i.action === 'untimeout') platformManageable = i.target.moderatable;
      } else target = userPrincipal(i.guild, i.target.id);
    } else if (i.target && !('roles' in i.target)) {
      target = userPrincipal(i.guild, i.target.id); // unban etc.: still protects self/bot/owner ids
    }
    return evaluateModeration({
      actor: memberPrincipal(i.guild, i.actor),
      bot: memberPrincipal(i.guild, i.bot),
      target,
      actorHasPermission: hasAllPerms(i.actor.permissions, ACTOR_PERMS[i.action]),
      botHasPermission: hasAllPerms(i.bot.permissions, BOT_PERMS[i.action]),
      platformManageable,
    });
  }

  assertModeration(i: ModerationCheck): void {
    const r = this.checkModeration(i);
    if (!r.allowed) {
      const code = r.code === 'actor_missing_permission' ? 'permission_denied' : r.code === 'bot_missing_permission' ? 'bot_permission' : 'hierarchy';
      throw new BotError(code, DENY_MESSAGES[r.code], `denied:${r.code}`);
    }
  }

  checkChannelAction(i: { actor: GuildMember; bot: GuildMember; channel: GuildBasedChannel; action: ModAction }): PermissionResult {
    return evaluateChannelAction({
      actorHasPermission: hasAllPerms(i.channel.permissionsFor(i.actor), ACTOR_PERMS[i.action]),
      botHasPermission: hasAllPerms(i.channel.permissionsFor(i.bot), BOT_PERMS[i.action]),
    });
  }

  assertChannelAction(i: { actor: GuildMember; bot: GuildMember; channel: GuildBasedChannel; action: ModAction }): void {
    const r = this.checkChannelAction(i);
    if (!r.allowed) {
      throw new BotError(r.code === 'actor_missing_permission' ? 'permission_denied' : 'bot_permission', DENY_MESSAGES[r.code], `denied:${r.code}`);
    }
  }
}
