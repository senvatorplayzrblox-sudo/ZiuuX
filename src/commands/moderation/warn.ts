import type { Command } from '../../types/command.js';
import { PermissionFlagsBits, addReason, confirmCase, guildOnlyBuilder, memberOption, reasonOf, resolveGuildActor } from '../shared.js';

export const warn: Command = {
  key: 'warn',
  data: addReason(guildOnlyBuilder('warn', 'Warn a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member to warn').setRequired(true))),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ModerateMembers], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const target = memberOption(interaction);
    const r = await client.services.moderation.warn({ guild, actor: member, reason: reasonOf(interaction) }, target);
    const n = await client.services.warnings.countActive(guild.id, target.id);
    await confirmCase(interaction, r.case, [`Warned <@${target.id}>. They now have **${n}** active warning(s).`], r.dmDelivered);
  },
};
