import type { Command } from '../../types/command.js';
import { ChannelType } from 'discord.js';
import { PermissionFlagsBits, addReason, asLockable, channelOption, confirmCase, guildOnlyBuilder, reasonOf, resolveGuildActor } from '../shared.js';

export const lock: Command = {
  key: 'lock',
  data: addReason(
    guildOnlyBuilder('lock', 'Prevent @everyone from sending messages in a channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (defaults to this one)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  ),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ManageChannels], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const channel = asLockable(await channelOption(interaction));
    const r = await client.services.moderation.lock({ guild, actor: member, reason: reasonOf(interaction) }, channel);
    await confirmCase(interaction, r.case, [`Locked <#${channel.id}>.`]);
  },
};
