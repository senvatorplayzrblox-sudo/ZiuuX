import 'dotenv/config';
import { getEnv } from '../src/config/env.js';
import { ALL_COMMANDS } from '../src/commands/index.js';
import { buildRegistry } from '../src/core/registry/CommandRegistry.js';
import { putCommands } from '../src/bootstrap/registerCommands.js';

// Forces (re-)registration. Uses GUILD_ID for instant guild-scoped registration, otherwise registers globally.
// Note: switching between guild and global scope leaves the previous scope's commands in place; remove them with
// `PUT []` on that scope (or delete them in the Developer Portal) if you switch.
const env = getEnv();
buildRegistry(ALL_COMMANDS); // validates names/keys
const n = await putCommands(env.DISCORD_TOKEN, env.CLIENT_ID, env.GUILD_ID, ALL_COMMANDS);
console.log(`Registered ${n} commands ${env.GUILD_ID ? `to guild ${env.GUILD_ID}` : 'globally (can take up to an hour to appear)'}.`);
