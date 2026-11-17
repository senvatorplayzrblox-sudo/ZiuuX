import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { getEnv } from '../src/config/env.js';
import { EMOJI_DEFS, EMOJI_KEYS } from '../src/config/emojis.js';

// Logs in briefly (Guilds intent only) and reports which of the 40 custom emoji IDs the bot can actually see.
const env = getEnv();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once(Events.ClientReady, () => {
  const missing = EMOJI_KEYS.filter((k) => !client.emojis.cache.has(EMOJI_DEFS[k].id));
  console.log(`Bot is in ${client.guilds.cache.size} server(s). ${EMOJI_KEYS.length - missing.length}/${EMOJI_KEYS.length} emojis resolved.`);
  if (missing.length) {
    console.log('NOT accessible (invite the bot to the server that owns these emojis):');
    for (const k of missing) console.log(`  - ${k}: <:${EMOJI_DEFS[k].name}:${EMOJI_DEFS[k].id}>`);
  }
  void client.destroy().then(() => process.exit(missing.length ? 1 : 0));
});
await client.login(env.DISCORD_TOKEN);
