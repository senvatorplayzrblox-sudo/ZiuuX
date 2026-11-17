import type { Command } from '../../types/command.js';
import { PermissionFlagsBits, addReason, confirmCase, guildOnlyBuilder, reasonOf, resolveGuildActor } from '../shared.js';

export const clearwarnings: Command = {
  key: 'clearwarnings',
  data: addReason(guildOnlyBuilder('clearwarnings', "Clear all of a user's active warnings").setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ModerateMembers], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const user = interaction.options.getUser('user', true);
    const r = await client.services.moderation.clearWarnings({ guild, actor: member, reason: reasonOf(interaction) }, user);
    await confirmCase(interaction, r.case, [`Cleared **${r.cleared}** active warning(s) for <@${user.id}>.`]);
  },
};
