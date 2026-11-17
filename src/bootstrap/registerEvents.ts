import type { ZiuuXClient } from '../client/ZiuuXClient.js';
import { ALL_EVENTS } from '../events/index.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('events');

/** Registers every event once. Each handler runs in an error boundary so one failing handler can never crash the bot. */
export function registerEvents(client: ZiuuXClient): void {
  for (const ev of ALL_EVENTS) {
    const handler = async (...args: unknown[]) => {
      try {
        await (ev.execute as (c: ZiuuXClient, ...a: unknown[]) => unknown)(client, ...args);
      } catch (err) {
        log.error({ err, event: String(ev.name) }, 'event handler failed');
      }
    };
    if (ev.once) client.once(ev.name, handler as never);
    else client.on(ev.name, handler as never);
  }
}
