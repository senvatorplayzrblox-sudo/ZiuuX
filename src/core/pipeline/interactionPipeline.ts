import type { Interaction } from 'discord.js';
import type { ZiuuXClient } from '../../client/ZiuuXClient.js';
import { parseCustomId } from '../../interactions/customId.js';
import { MODULE_HANDLERS } from '../../interactions/index.js';
import { reportInteractionError } from '../errors/errorHandler.js';
import { BotError } from '../errors/BotError.js';
import { runCommand } from './commandPipeline.js';
import { childLogger } from '../../utils/logger.js';

const log = childLogger('interactions');

/** Routes every interaction: slash commands, buttons, select menus (all kinds) and modals. Registered once; no collectors, so panels survive restarts. */
export async function routeInteraction(client: ZiuuXClient, interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) return runCommand(client, interaction);

  if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
    try {
      const parsed = parseCustomId(interaction.customId);
      if (!parsed) throw new BotError('not_found', 'This panel has expired or is no longer valid. Please run the command again.');
      await MODULE_HANDLERS[parsed.module].handle({ client, interaction, action: parsed.action, args: parsed.args });
    } catch (err) {
      log.debug({ id: interaction.customId }, 'component ended with error');
      await reportInteractionError(interaction, err, { customId: interaction.customId, guildId: interaction.guildId });
    }
  }
}
