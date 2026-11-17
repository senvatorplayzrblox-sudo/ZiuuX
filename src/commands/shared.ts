import { ChannelType, GuildMember, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildBasedChannel, type NewsChannel, type SlashCommandOptionsOnlyBuilder, type TextChannel } from 'discord.js';
import { BotError } from '../core/errors/BotError.js';
import { LIMITS } from '../config/constants.js';
import { withEmoji, type EmojiKey } from '../config/emojis.js';
import { successEmbed } from '../ui/embeds/base.js';
import { titled } from '../ui/embeds/base.js';
import { resolveGuildActor, type GuildActor } from '../core/access.js';
import { notify } from '../core/respond.js';
import type { CaseDoc } from '../types/moderation.js';
import { CASE_EMOJI, CASE_LABEL } from '../ui/embeds/case.js';

export { resolveGuildActor, type GuildActor, PermissionFlagsBits };

export const guildOnlyBuilder = (name: string, description: string) =>
  new SlashCommandBuilder().setName(name).setDescription(description).setContexts(InteractionContextType.Guild);

/** Call after at least one option has been added (every moderation command does). */
export const addReason = (b: SlashCommandOptionsOnlyBuilder): SlashCommandOptionsOnlyBuilder =>
  b.addStringOption((o) => o.setName('reason').setDescription('Reason (shown in the audit log and case)').setMaxLength(LIMITS.reasonMax).setRequired(false));

export function reasonOf(i: ChatInputCommandInteraction): string | null {
  return i.options.getString('reason');
}

export function memberOption(i: ChatInputCommandInteraction, name = 'user'): GuildMember {
  const m = i.options.getMember(name);
  if (!(m instanceof GuildMember)) throw new BotError('not_found', 'That user is not a member of this server.');
  return m;
}

export type LockableChannel = TextChannel | NewsChannel;

/** Resolves the chosen channel (or the current one) to a full guild channel object. */
export async function channelOption(i: ChatInputCommandInteraction, name = 'channel'): Promise<GuildBasedChannel> {
  const guild = i.guild;
  const id = i.options.getChannel(name)?.id ?? i.channelId;
  if (!guild || !id) throw new BotError('not_found', 'I could not determine the channel.');
  const ch = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
  if (!ch) throw new BotError('not_found', 'That channel could not be found.');
  return ch;
}

export function asLockable(c: { type: ChannelType }): LockableChannel {
  if (c.type !== ChannelType.GuildText && c.type !== ChannelType.GuildAnnouncement) throw new BotError('invalid_input', 'Only text and announcement channels can be locked.');
  return c as unknown as LockableChannel;
}

export function asTextChannel(c: { type: ChannelType }): TextChannel {
  if (c.type !== ChannelType.GuildText) throw new BotError('invalid_input', 'Slowmode can only be set on regular text channels.');
  return c as unknown as TextChannel;
}

/** Standard ephemeral confirmation for moderation commands (the public record is the moderation log). */
export async function confirmCase(i: ChatInputCommandInteraction, c: CaseDoc, lines: string[], dm?: boolean | null): Promise<void> {
  const extra = dm === null || dm === undefined ? [] : [dm ? 'The user was notified by DM.' : 'The user could not be notified by DM.'];
  await notify(i, titled('success', CASE_EMOJI[c.type], `${CASE_LABEL[c.type]} • Case #${c.caseNumber}`, [...lines, ...extra].join('\n')));
}

export { successEmbed, withEmoji };
export type { EmojiKey };
