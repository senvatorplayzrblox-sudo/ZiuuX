import { GuildMember, PermissionFlagsBits, type Guild, type GuildTextBasedChannel } from 'discord.js';
import { BotError } from './errors/BotError.js';
import type { CommandKey } from '../config/commandKeys.js';
import type { ConfigPanel } from '../permissions/types.js';
import type { Services } from '../types/services.js';
import type { AnyRepliable } from './respond.js';

export interface GuildActor { guild: Guild; member: GuildMember }

/** Resolves the invoking member from the interaction payload (fresh permissions), fetching only if needed. */
export async function resolveGuildActor(i: AnyRepliable): Promise<GuildActor> {
  const guild = i.guild ?? (i.guildId ? await i.client.guilds.fetch(i.guildId).catch(() => null) : null);
  if (!guild) throw new BotError('guild_only', 'This can only be used inside a server.');
  const member = i.member instanceof GuildMember ? i.member : await guild.members.fetch(i.user.id).catch(() => null);
  if (!member) throw new BotError('guild_only', 'I could not resolve your server membership. Please try again.');
  return { guild, member };
}

/** Channel id plus the parent id for threads, so channel allow-lists work inside threads. */
export function channelIdsOf(i: AnyRepliable): string[] {
  const ch = i.channel;
  const ids = i.channelId ? [i.channelId] : [];
  if (ch && 'isThread' in ch && ch.isThread() && ch.parentId) ids.push(ch.parentId);
  return ids;
}

/** /cmdconfig enforcement. Used by the command pipeline AND by every panel action (so panels cannot bypass it). */
export function assertCommandAllowed(s: Services, a: GuildActor, key: CommandKey, i: AnyRepliable): Promise<void> {
  return s.commandConfig.assertAllowed(a.guild.id, key, [...a.member.roles.cache.keys()], channelIdsOf(i));
}

export async function assertConfigAccess(s: Services, a: GuildActor, panel: ConfigPanel): Promise<void> {
  const discordAllowed = a.member.permissions.has(PermissionFlagsBits.ManageGuild) || a.member.permissions.has(PermissionFlagsBits.Administrator);
  const ok = await s.ownerGate.canAccessConfigPanel({ userId: a.member.id, guildId: a.guild.id, panel, discordAllowed });
  if (!ok) throw new BotError('permission_denied', 'You need the **Manage Server** or **Administrator** permission to use this.');
}

export async function assertStaffAccess(s: Services, a: GuildActor): Promise<void> {
  const discordAllowed = await s.staffPanel.hasStaffAccess(a.member);
  const ok = await s.ownerGate.canAccessConfigPanel({ userId: a.member.id, guildId: a.guild.id, panel: 'staffpanel', discordAllowed });
  if (!ok) throw new BotError('permission_denied', 'The staff panel is only available to staff (a configured staff role or **Timeout Members**).');
}

export async function resolveBot(guild: Guild) {
  return guild.members.me ?? (await guild.members.fetchMe());
}

export function isGuildTextChannel(ch: unknown): ch is GuildTextBasedChannel {
  return !!ch && typeof ch === 'object' && 'isTextBased' in ch && (ch as { isTextBased(): boolean }).isTextBased() && 'guild' in ch;
}
