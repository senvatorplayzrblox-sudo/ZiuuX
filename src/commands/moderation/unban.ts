import type { Command } from '../../types/command.js';
import { BotError } from '../../core/errors/BotError.js';
import { parseSnowflake } from '../../utils/snowflake.js';
import { PermissionFlagsBits, addReason, confirmCase, guildOnlyBuilder, reasonOf, resolveGuildActor } from '../shared.js';

export const unban: Command = {
  key: 'unban',
  data: addReason(guildOnlyBuilder('unban', 'Unban a user by ID').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addStringOption((o) => o.setName('user_id').setDescription('ID of the banned user').setRequired(true))),
  access: 'moderation', guildOnly: true, requiredUserPerms: [PermissionFlagsBits.BanMembers], defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild, member } = await resolveGuildActor(interaction);
    const id = parseSnowflake(interaction.options.getString('user_id', true));
    if (!id) throw new BotError('invalid_input', 'That is not a valid user ID.');
    const r = await client.services.moderation.unban({ guild, actor: member, reason: reasonOf(interaction) }, id);
    await confirmCase(interaction, r.case, [`Unbanned <@${id}> (\`${id}\`).`]);
  },
};
