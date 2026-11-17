import 'dotenv/config';
import { getEnv, secretValues } from './config/env.js';
import { registerSecrets } from './utils/redact.js';
import { logger } from './utils/logger.js';
import { connectDatabase, isDatabaseConnected } from './database/connect.js';
import { createServices } from './bootstrap/services.js';
import { startHealthServer } from './bootstrap/healthServer.js';
import { registerEvents } from './bootstrap/registerEvents.js';
import { installProcessHandlers } from './bootstrap/shutdown.js';
import { ZiuuXClient } from './client/ZiuuXClient.js';
import { ALL_COMMANDS } from './commands/index.js';
import { buildRegistry } from './core/registry/CommandRegistry.js';

async function main(): Promise<void> {
  const env = getEnv(); // fails fast with a readable list of every problem
  registerSecrets(secretValues(env));

  const server = startHealthServer(env.PORT, isDatabaseConnected);
  await connectDatabase(env.MONGODB_URI);

  const services = createServices();
  await services.botSettings.init({ provider: env.AI_DEFAULT_PROVIDER, model: env.AI_DEFAULT_MODEL });

  const client = new ZiuuXClient(services);
  for (const [name, cmd] of buildRegistry(ALL_COMMANDS)) client.commands.set(name, cmd);
  registerEvents(client);
  installProcessHandlers(client, server);

  await client.login(env.DISCORD_TOKEN);
}

main().catch((err) => {
  logger.fatal({ err: err instanceof Error ? err.message : String(err) }, 'fatal startup error');
  process.exit(1);
});
