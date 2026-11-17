import { Client, GatewayIntentBits, Partials, Options } from 'discord.js';
import type { Services } from '../types/services.js';
import type { Command } from '../types/command.js';

export class ZiuuXClient extends Client {
  readonly commands = new Map<string, Command>();
  readonly startedAt = Date.now();
  constructor(public readonly services: Services) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // privileged: join/leave logs, role/timeout diffs
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // privileged: AI scanning, edit/delete log content
        GatewayIntentBits.GuildModeration,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
      allowedMentions: { parse: [], repliedUser: false }, // user content can never ping anyone
      makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 200, PresenceManager: 0 }),
    });
  }
}
