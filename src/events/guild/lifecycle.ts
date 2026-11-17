import { Events } from 'discord.js';
import { defineEvent } from '../../types/event.js';
import { logger } from '../../utils/logger.js';

export const guildCreate = defineEvent({
  name: Events.GuildCreate,
  async execute(client, guild) {
    await client.services.guildSettings.onGuildJoin(guild.id);
    logger.info({ guildId: guild.id }, 'joined guild; default settings provisioned');
  },
});

export const guildDelete = defineEvent({
  name: Events.GuildDelete,
  async execute(client, guild) {
    if (!guild.available) return; // outage, not a removal
    await client.services.guildSettings.onGuildLeave(guild.id);
    logger.info({ guildId: guild.id }, 'left guild; data retained for the retention period');
  },
});
