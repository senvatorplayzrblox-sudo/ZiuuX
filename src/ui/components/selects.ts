import { ChannelSelectMenuBuilder, ChannelType, RoleSelectMenuBuilder, UserSelectMenuBuilder, type Guild } from 'discord.js';
import { truncate } from '../../utils/text.js';

export const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;

/** Role select pre-filled with the CURRENT selection (only roles that still exist). */
export function roleSelect(customId: string, placeholder: string, current: string[], guild: Guild, max = 25): RoleSelectMenuBuilder {
  const defaults = current.filter((id) => guild.roles.cache.has(id)).slice(0, max);
  const m = new RoleSelectMenuBuilder().setCustomId(customId).setPlaceholder(truncate(placeholder, 150)).setMinValues(0).setMaxValues(max);
  if (defaults.length) m.setDefaultRoles(defaults);
  return m;
}

export function channelSelect(customId: string, placeholder: string, current: string[], guild: Guild, opts: { max?: number; min?: number } = {}): ChannelSelectMenuBuilder {
  const max = opts.max ?? 25;
  const defaults = current.filter((id) => guild.channels.cache.has(id)).slice(0, max);
  const m = new ChannelSelectMenuBuilder().setCustomId(customId).setPlaceholder(truncate(placeholder, 150)).setChannelTypes(...TEXT_CHANNEL_TYPES).setMinValues(opts.min ?? 0).setMaxValues(max);
  if (defaults.length) m.setDefaultChannels(defaults);
  return m;
}

export function userSelect(customId: string, placeholder: string, current: string[] = [], opts: { min?: number; max?: number } = {}): UserSelectMenuBuilder {
  const max = opts.max ?? 1;
  const m = new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(truncate(placeholder, 150)).setMinValues(opts.min ?? 1).setMaxValues(max);
  const defaults = current.slice(0, max);
  if (defaults.length) m.setDefaultUsers(defaults);
  return m;
}
