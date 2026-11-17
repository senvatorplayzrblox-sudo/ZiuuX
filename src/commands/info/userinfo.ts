import { GuildMember, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { titled, field } from '../../ui/embeds/base.js';
import { tsBoth } from '../../utils/time.js';
import { truncate } from '../../utils/text.js';

const KEY_PERMS = ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'ManageMessages', 'KickMembers', 'BanMembers', 'ModerateMembers'] as const;

export const userinfo: Command = {
  key: 'userinfo',
  data: new SlashCommandBuilder().setName('userinfo').setDescription('Show information about a user').setContexts(InteractionContextType.Guild).addUserOption((o) => o.setName('user').setDescription('User (defaults to you)')),
  access: 'public', guildOnly: true, defer: 'none',
  async execute({ interaction }) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const m = interaction.options.getMember('user') ?? (user.id === interaction.user.id ? interaction.member : null);
    const member = m instanceof GuildMember ? m : null;
    const embed = titled('info', 'user', user.tag).setThumbnail(member?.displayAvatarURL({ size: 256 }) ?? user.displayAvatarURL({ size: 256 })).addFields(
      field('User', `<@${user.id}>\n\`${user.id}\``, true),
      field('Type', user.bot ? 'Bot' : 'Human', true),
      field('Account created', tsBoth(user.createdAt)),
    );
    const badges = user.flags?.toArray() ?? [];
    if (badges.length) embed.addFields(field('Badges', badges.join(', ')));
    if (member) {
      embed.addFields(field('Joined server', member.joinedAt ? tsBoth(member.joinedAt) : 'unknown'));
      if (member.nickname) embed.addFields(field('Nickname', truncate(member.nickname, 100), true));
      const roles = member.roles.cache.filter((r) => r.id !== member.guild.id).sort((a, b) => b.position - a.position);
      embed.addFields(field(`Roles (${roles.size})`, roles.size ? truncate([...roles.values()].slice(0, 15).map((r) => `<@&${r.id}>`).join(' ') + (roles.size > 15 ? ` +${roles.size - 15} more` : ''), 1000) : 'None'));
      const perms = KEY_PERMS.filter((p) => member.permissions.has(PermissionFlagsBits[p]));
      if (perms.length) embed.addFields(field('Key permissions', perms.join(', ')));
      if (member.isCommunicationDisabled()) embed.addFields(field('Timed out until', tsBoth(member.communicationDisabledUntil)));
    } else embed.setFooter({ text: 'ZiuuX • not a member of this server' });
    await interaction.reply({ embeds: [embed] });
  },
};
