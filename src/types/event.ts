import type { ClientEvents } from 'discord.js';
import type { ZiuuXClient } from '../client/ZiuuXClient.js';

export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(client: ZiuuXClient, ...args: ClientEvents[K]): Promise<void> | void;
}

/** Helper that keeps the event name and argument types linked. */
export const defineEvent = <K extends keyof ClientEvents>(e: BotEvent<K>): BotEvent<K> => e;
