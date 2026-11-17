import type { Command } from '../../types/command.js';
import { PermissionFlagsBits, addReason, confirmCase, guildOnlyBuilder, memberOption, reasonOf, resolveGuildActor } from '../shared.js';

export const kick: Command = {
  key: 'kick',
  data: addReason(guildOnlyBuilder('kick', 'Kick a member from the server').setDefaultMemberPermissions(PermissionFlagsBits.KickMembers).addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.KickMembers], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const target = memberOption(interaction);
    const r = await client.services.moderation.kick({ guild, actor: member, reason: reasonOf(interaction) }, target);
    await confirmCase(interaction, r.case, [`Kicked <@${target.id}>.`], r.dmDelivered);
  },
};
