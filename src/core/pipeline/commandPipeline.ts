import type { ChatInputCommandInteraction } from 'discord.js';
import type { ZiuuXClient } from '../../client/ZiuuXClient.js';
import { BotError } from '../errors/BotError.js';
import { reportInteractionError } from '../errors/errorHandler.js';
import { assertCommandAllowed, assertConfigAccess, assertStaffAccess, resolveGuildActor, type GuildActor } from '../access.js';
import { deferEphemeral } from '../respond.js';
import { childLogger } from '../../utils/logger.js';

const log = childLogger('commands');

/** Single choke point for every slash command: guild checks -> /cmdconfig -> access rules -> defer -> execute (in an error boundary). */
export async function runCommand(client: ZiuuXClient, interaction: ChatInputCommandInteraction): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  try {
    if (!command) throw new BotError('not_found', 'That command is not available.');
    const s = client.services;
    let actor: GuildActor | null = null;

    if (interaction.inGuild()) {
      actor = await resolveGuildActor(interaction);
      await s.guildSettings.ensure(actor.guild.id);
      await assertCommandAllowed(s, actor, command.key, interaction); // no-op for /cmdconfig and /botsettings
    } else if (command.guildOnly) {
      throw new BotError('guild_only', 'This command can only be used inside a server.');
    }

    switch (command.access) {
      case 'public':
        break;
      case 'moderation': {
        if (!actor) throw new BotError('guild_only', 'This command can only be used inside a server.');
        const needed = command.requiredUserPerms ?? [];
        if (!needed.every((p) => actor!.member.permissions.has(p))) throw new BotError('permission_denied', 'You do not have the Discord permission required for this command.');
        break;
      }
      case 'config':
        if (!actor) throw new BotError('guild_only', 'This command can only be used inside a server.');
        await assertConfigAccess(s, actor, command.key as 'aimod' | 'cmdconfig' | 'setlogs' | 'listlogs');
        break;
      case 'staff':
        if (!actor) throw new BotError('guild_only', 'This command can only be used inside a server.');
        await assertStaffAccess(s, actor);
        break;
      case 'owner':
        s.ownerGate.assertOwner(interaction.user.id);
        break;
    }

    if (command.defer === 'ephemeral') await deferEphemeral(interaction);
    await command.execute({ client, interaction });
  } catch (err) {
    log.debug({ command: interaction.commandName, user: interaction.user.id }, 'command ended with error');
    await reportInteractionError(interaction, err, { command: interaction.commandName, guildId: interaction.guildId });
  }
}
