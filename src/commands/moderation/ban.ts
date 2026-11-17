import type { Command } from '../../types/command.js';
import { PermissionFlagsBits, addReason, confirmCase, guildOnlyBuilder, reasonOf, resolveGuildActor } from '../shared.js';

export const ban: Command = {
  key: 'ban',
  data: addReason(
    guildOnlyBuilder('ban', 'Permanently ban a user (works for users who already left)')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
      .addIntegerOption((o) => o.setName('delete_days').setDescription('Days of message history to delete (0-7)').setMinValue(0).setMaxValue(7)),
  ),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.BanMembers], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const user = interaction.options.getUser('user', true);
    const r = await client.services.moderation.ban({ guild, actor: member, reason: reasonOf(interaction) }, user, interaction.options.getInteger('delete_days') ?? 0);
    await confirmCase(interaction, r.case, [`Banned <@${user.id}> (\`${user.id}\`) permanently.`], r.dmDelivered);
  },
};
