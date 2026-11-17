import type { Command } from '../../types/command.js';
import { PermissionFlagsBits, addReason, confirmCase, guildOnlyBuilder, memberOption, reasonOf, resolveGuildActor } from '../shared.js';

export const untimeout: Command = {
  key: 'untimeout',
  data: addReason(guildOnlyBuilder('untimeout', "Remove a member's timeout").setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ModerateMembers], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const target = memberOption(interaction);
    const r = await client.services.moderation.untimeout({ guild, actor: member, reason: reasonOf(interaction) }, target);
    await confirmCase(interaction, r.case, [`Removed the timeout from <@${target.id}>.`]);
  },
};
