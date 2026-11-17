import { Events } from 'discord.js';
import { defineEvent } from '../../types/event.js';
import { updateEmojiAvailability } from '../../config/emojis.js';
import { GuildSettingsRepo } from '../../database/repositories/index.js';
import { registerCommands } from '../../bootstrap/registerCommands.js';
import { setDiscordReady } from '../../bootstrap/healthServer.js';
import { logger } from '../../utils/logger.js';

export default defineEvent({
  name: Events.ClientReady,
  once: true,
  async execute(client, ready) {
    logger.info({ tag: ready.user.tag, guilds: ready.guilds.cache.size }, 'ZiuuX is online');
    ready.user.setPresence({ activities: [{ name: '/staffpanel' }], status: 'online' });

    const missing = updateEmojiAvailability((id) => client.emojis.cache.has(id));
    if (missing.length) logger.warn({ missing }, 'Some custom emojis are not accessible to the bot; they will be omitted. Invite the bot to the server that owns them.');

    try {
      const ids = [...client.guilds.cache.keys()];
      for (const id of ids) await client.services.guildSettings.ensure(id);
      // Only safe without sharding: with shards each process sees a subset of guilds.
      if (!client.shard) {
        const n = await GuildSettingsRepo.markMissingInactive(ids);
        if (n) logger.info({ count: n }, 'marked guilds the bot is no longer in as inactive');
      }
    } catch (err) {
      logger.error({ err }, 'guild reconciliation failed');
    }

    await registerCommands(client).catch((err) => logger.error({ err }, 'command registration failed'));
    client.services.retention.start();
    client.services.health.start();
    setDiscordReady(true);
  },
});
