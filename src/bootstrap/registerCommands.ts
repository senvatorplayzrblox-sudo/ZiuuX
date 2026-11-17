import { REST, Routes } from 'discord.js';
import { getEnv } from '../config/env.js';
import { ALL_COMMANDS } from '../commands/index.js';
import { commandHash, commandPayload } from '../core/registry/CommandRegistry.js';
import type { Command } from '../types/command.js';
import type { ZiuuXClient } from '../client/ZiuuXClient.js';
import { logger } from '../utils/logger.js';

/** PUTs the full command list. GUILD_ID => instant guild-scoped registration (development); otherwise global. */
export async function putCommands(token: string, clientId: string, guildId: string | undefined, commands: Command[]): Promise<number> {
  const rest = new REST({ version: '10' }).setToken(token);
  const body = commandPayload(commands);
  await rest.put(guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId), { body });
  return body.length;
}

/** Boot-time registration, skipped when the command definitions are unchanged (avoids rate limits on every restart). */
export async function registerCommands(client: ZiuuXClient, force = false): Promise<void> {
  const env = getEnv();
  const scope = env.GUILD_ID ? `guild:${env.GUILD_ID}` : 'global';
  const hash = commandHash(ALL_COMMANDS, scope);
  if (!force && (await client.services.botSettings.getCommandsHash()) === hash) {
    logger.info({ scope }, 'slash commands unchanged; skipping registration');
    return;
  }
  const n = await putCommands(env.DISCORD_TOKEN, env.CLIENT_ID, env.GUILD_ID, ALL_COMMANDS);
  await client.services.botSettings.setCommandsHash(hash);
  logger.info({ scope, count: n }, 'slash commands registered');
}
