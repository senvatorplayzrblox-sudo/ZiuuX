import { ChannelType, GuildVerificationLevel, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { titled, field } from '../../ui/embeds/base.js';
import { e } from '../../config/emojis.js';
import { tsBoth } from '../../utils/time.js';
import { BotError } from '../../core/errors/BotError.js';

export const serverinfo: Command = {
  key: 'serverinfo',
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Show information about this server').setContexts(InteractionContextType.Guild),
  access: 'public', guildOnly: true, defer: 'none',
  async execute({ interaction }) {
    const guild = interaction.guild;
    if (!guild) throw new BotError('guild_only', 'This can only be used inside a server.');
    const ch = guild.channels.cache;
    const count = (...t: ChannelType[]) => ch.filter((c) => t.includes(c.type)).size;
    const embed = titled('info', 'info', guild.name).addFields(
      field('Owner', `<@${guild.ownerId}>`, true),
      field('ID', `\`${guild.id}\``, true),
      field('Created', tsBoth(guild.createdAt)),
      field('Members', String(guild.memberCount), true),
      field('Roles', String(guild.roles.cache.size - 1), true),
      field('Emojis', String(guild.emojis.cache.size), true),
      field('Channels', `${e('message')} Text: ${count(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)}\n${e('voice')} Voice: ${count(ChannelType.GuildVoice, ChannelType.GuildStageVoice)}\nCategories: ${count(ChannelType.GuildCategory)}`, true),
      field('Boosts', `Tier ${guild.premiumTier} • ${guild.premiumSubscriptionCount ?? 0} boosts`, true),
      field('Verification', GuildVerificationLevel[guild.verificationLevel] ?? String(guild.verificationLevel), true),
    );
    const icon = guild.iconURL({ size: 256 });
    if (icon) embed.setThumbnail(icon);
    if (guild.description) embed.setDescription(guild.description);
    await interaction.reply({ embeds: [embed] });
  },
};
