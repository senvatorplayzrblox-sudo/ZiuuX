import { Events } from 'discord.js';
import { defineEvent } from '../../types/event.js';
import { logger } from '../../utils/logger.js';
import { redactSecrets } from '../../utils/redact.js';

export const clientError = defineEvent({
  name: Events.Error,
  execute(_c, err) {
    logger.error({ err: redactSecrets(err.message) }, 'discord client error');
  },
});

export const clientWarn = defineEvent({
  name: Events.Warn,
  execute(_c, msg) {
    logger.warn({ msg: redactSecrets(msg) }, 'discord client warning');
  },
});
