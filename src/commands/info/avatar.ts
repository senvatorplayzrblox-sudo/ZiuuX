import { GuildMember, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { titled } from '../../ui/embeds/base.js';

export const avatar: Command = {
  key: 'avatar',
  data: new SlashCommandBuilder().setName('avatar').setDescription("Show a user's avatar").setContexts(InteractionContextType.Guild).addUserOption((o) => o.setName('user').setDescription('User (defaults to you)')),
  access: 'public', guildOnly: true, defer: 'none',
  async execute({ interaction }) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const m = interaction.options.getMember('user') ?? (user.id === interaction.user.id ? interaction.member : null);
    const member = m instanceof GuildMember ? m : null;
    const global = user.displayAvatarURL({ size: 1024 });
    const server = member?.avatar ? member.displayAvatarURL({ size: 1024 }) : null;
    const links = [`[Global avatar](${global})`, ...(server ? [`[Server avatar](${server})`] : [])].join(' • ');
    await interaction.reply({ embeds: [titled('info', 'user', `${user.tag}'s avatar`, links).setImage(server ?? global)] });
  },
};
