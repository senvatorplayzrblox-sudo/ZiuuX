import type { Command } from '../../types/command.js';
import { ChannelType } from 'discord.js';
import { PermissionFlagsBits, addReason, asLockable, channelOption, confirmCase, guildOnlyBuilder, reasonOf, resolveGuildActor } from '../shared.js';

export const unlock: Command = {
  key: 'unlock',
  data: addReason(
    guildOnlyBuilder('unlock', 'Restore a locked channel to its previous permissions')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (defaults to this one)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  ),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ManageChannels], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const channel = asLockable(await channelOption(interaction));
    const r = await client.services.moderation.unlock({ guild, actor: member, reason: reasonOf(interaction) }, channel);
    await confirmCase(interaction, r.case, [`Unlocked <#${channel.id}>.`, ...(r.note ? [r.note] : [])]);
  },
};
