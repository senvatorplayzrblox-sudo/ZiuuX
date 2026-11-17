import type { Command } from '../../types/command.js';
import { PermissionFlagsBits, guildOnlyBuilder, resolveGuildActor } from '../shared.js';
import { notify } from '../../core/respond.js';
import { titled, field } from '../../ui/embeds/base.js';
import { ts } from '../../utils/time.js';
import { truncate } from '../../utils/text.js';

export const warnings: Command = {
  key: 'warnings',
  data: guildOnlyBuilder('warnings', "View a user's warnings").setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('User to look up').setRequired(true)),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ModerateMembers], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild } = await resolveGuildActor(interaction);
    const user = interaction.options.getUser('user', true);
    const [list, active] = await Promise.all([client.services.warnings.list(guild.id, user.id, { limit: 15 }), client.services.warnings.countActive(guild.id, user.id)]);
    const embed = titled('warning', 'warn', `Warnings for ${user.tag}`, `<@${user.id}> has **${active}** active warning(s).`);
    if (list.length === 0) embed.setDescription(`<@${user.id}> has no warnings in this server.`);
    else {
      embed.addFields(list.map((w) => field(`#${w.caseNumber} • ${w.active ? 'Active' : 'Removed'}`, truncate(`${w.reason ?? 'No reason provided'}\nBy <@${w.moderatorId}> • ${ts(w.createdAt, 'R')}`, 1000))));
      if (active > list.filter((w) => w.active).length) embed.setFooter({ text: 'Showing the 15 most recent warnings' });
    }
    await notify(interaction, embed);
  },
};
