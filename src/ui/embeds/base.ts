import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../../config/constants.js';
import { e, withEmoji, type EmojiKey } from '../../config/emojis.js';
import { truncate } from '../../utils/text.js';

export type EmbedKind = keyof typeof COLORS;

/** Every ZiuuX embed starts here so colours, footer and timestamp stay consistent. */
export function baseEmbed(kind: EmbedKind = 'primary'): EmbedBuilder {
  return new EmbedBuilder().setColor(COLORS[kind]).setFooter({ text: 'ZiuuX' }).setTimestamp();
}

export function titled(kind: EmbedKind, emoji: EmojiKey, title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(kind).setTitle(truncate(withEmoji(emoji, title), 256));
  if (description) embed.setDescription(truncate(description, 4096));
  return embed;
}

export const successEmbed = (description: string, title = 'Success') => titled('success', 'success', title, description);
export const errorEmbed = (description: string, title = 'Error') => titled('error', 'error', title, description);
export const infoEmbed = (description: string, title = 'Info') => titled('info', 'info', title, description);
export const warnEmbed = (description: string, title = 'Warning') => titled('warning', 'warning', title, description);

export const statusIcon = (on: boolean) => (on ? e('enabled') : e('disabled'));

export const field = (name: string, value: string, inline = false) => ({ name: truncate(name, 256), value: truncate(value || '\u200b', 1024), inline });
