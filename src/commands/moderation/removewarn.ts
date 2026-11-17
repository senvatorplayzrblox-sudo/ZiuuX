import type { Command } from '../../types/command.js';
import { PermissionFlagsBits, addReason, confirmCase, guildOnlyBuilder, reasonOf, resolveGuildActor } from '../shared.js';

export const removewarn: Command = {
  key: 'removewarn',
  data: addReason(guildOnlyBuilder('removewarn', 'Remove a warning by its case number').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addIntegerOption((o) => o.setName('case').setDescription('Case number of the warning').setMinValue(1).setRequired(true))),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ModerateMembers], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const caseNumber = interaction.options.getInteger('case', true);
    const r = await client.services.moderation.removeWarning({ guild, actor: member, reason: reasonOf(interaction) }, caseNumber);
    await confirmCase(interaction, r.case, [`Removed warning #${caseNumber} from <@${r.userId}>.`]);
  },
};
