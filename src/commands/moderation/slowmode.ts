import type { Command } from '../../types/command.js';
import { ChannelType } from 'discord.js';
import { LIMITS } from '../../config/constants.js';
import { PermissionFlagsBits, addReason, asTextChannel, channelOption, confirmCase, guildOnlyBuilder, reasonOf, resolveGuildActor } from '../shared.js';

export const slowmode: Command = {
  key: 'slowmode',
  data: addReason(
    guildOnlyBuilder('slowmode', 'Set a channel slowmode (0 disables it)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addIntegerOption((o) => o.setName('seconds').setDescription('Seconds between messages (0-21600)').setMinValue(0).setMaxValue(LIMITS.slowmodeMaxSeconds).setRequired(true))
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (defaults to this one)').addChannelTypes(ChannelType.GuildText)),
  ),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ManageChannels], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const channel = asTextChannel(await channelOption(interaction));
    const seconds = interaction.options.getInteger('seconds', true);
    const r = await client.services.moderation.slowmode({ guild, actor: member, reason: reasonOf(interaction) }, channel, seconds);
    await confirmCase(interaction, r.case, [seconds === 0 ? `Disabled slowmode in <#${channel.id}>.` : `Set slowmode in <#${channel.id}> to **${seconds}s**.`]);
  },
};
