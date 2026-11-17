import type { Command } from '../../types/command.js';
import { BotError } from '../../core/errors/BotError.js';
import { LIMITS } from '../../config/constants.js';
import { formatDuration, parseDuration } from '../../utils/duration.js';
import { PermissionFlagsBits, addReason, confirmCase, guildOnlyBuilder, memberOption, reasonOf, resolveGuildActor } from '../shared.js';

export const timeout: Command = {
  key: 'timeout',
  data: addReason(
    guildOnlyBuilder('timeout', 'Time a member out')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('user').setDescription('Member to time out').setRequired(true))
      .addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 2h, 1d, 1h30m (max 28d)').setRequired(true)),
  ),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.ModerateMembers], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const target = memberOption(interaction);
    const ms = parseDuration(interaction.options.getString('duration', true));
    if (ms === null || ms < LIMITS.timeoutMinMs || ms > LIMITS.timeoutMaxMs) throw new BotError('invalid_input', 'Invalid duration. Use units like `10m`, `2h`, `1d`, `1h30m` (5 seconds to 28 days).');
    const r = await client.services.moderation.timeout({ guild, actor: member, reason: reasonOf(interaction) }, target, ms);
    await confirmCase(interaction, r.case, [`Timed out <@${target.id}> for **${formatDuration(ms)}**.`], r.dmDelivered);
  },
};
