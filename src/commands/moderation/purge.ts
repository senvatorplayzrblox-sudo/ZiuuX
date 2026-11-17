import { BotError } from '../../core/errors/BotError.js';
import type { Command } from '../../types/command.js';
import { LIMITS } from '../../config/constants.js';
import { PermissionFlagsBits, addReason, channelOption, confirmCase, guildOnlyBuilder, reasonOf, resolveGuildActor } from '../shared.js';

export const purge: Command = {
  key: 'purge',
  data: addReason(
    guildOnlyBuilder('purge', 'Bulk-delete recent messages (max 100, newer than 14 days)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption((o) => o.setName('amount').setDescription('Number of messages (1-100)').setMinValue(1).setMaxValue(LIMITS.purgeMax).setRequired(true))
      .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user'))
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (defaults to this one)')),
  ),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ManageMessages], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const channel = await channelOption(interaction);
    if (!channel.isTextBased()) throw new BotError('invalid_input', 'Choose a server text channel.');
    const user = interaction.options.getUser('user');
    const r = await client.services.moderation.purge({ guild, actor: member, reason: reasonOf(interaction) }, channel, interaction.options.getInteger('amount', true), user?.id);
    await confirmCase(interaction, r.case, [`Deleted **${r.deleted}** message(s) in <#${channel.id}>${user ? ` from <@${user.id}>` : ''}.`]);
  },
};
