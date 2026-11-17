import { randomBytes } from 'node:crypto';
import { DiscordAPIError } from 'discord.js';
import { BotError } from './BotError.js';
import { notify, type AnyRepliable } from '../respond.js';
import { errorEmbed } from '../../ui/embeds/base.js';
import { childLogger } from '../../utils/logger.js';
import { redactSecrets } from '../../utils/redact.js';

const log = childLogger('errors');

const DISCORD_MESSAGES: Record<number, string> = {
  50013: 'I am missing a permission needed for that. Please check my role and the channel permissions.',
  50001: 'I do not have access to that channel or resource.',
  10008: 'That message no longer exists.',
  10007: 'That member could not be found.',
  10013: 'That user could not be found.',
  10003: 'That channel no longer exists.',
  50007: 'I could not send a direct message to that user.',
};

export function describeError(err: unknown): { message: string; expected: boolean; ref: string | null } {
  if (err instanceof BotError) return { message: err.userMessage, expected: true, ref: null };
  if (err instanceof DiscordAPIError) {
    const known = typeof err.code === 'number' ? DISCORD_MESSAGES[err.code] : undefined;
    if (known) return { message: known, expected: true, ref: null };
  }
  const ref = randomBytes(4).toString('hex');
  return { message: `Something went wrong while processing that. If it keeps happening, mention reference \`${ref}\` to the bot owner.`, expected: false, ref };
}

/** Never throws. Expected errors are shown to the user; unexpected ones are logged with a reference id. */
export async function reportInteractionError(interaction: AnyRepliable, err: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const d = describeError(err);
  if (!d.expected) {
    const e = err instanceof Error ? err : new Error(String(err));
    log.error({ ref: d.ref, ...context, err: { name: e.name, message: redactSecrets(e.message), stack: redactSecrets(e.stack ?? '') } }, 'unhandled interaction error');
  }
  try {
    await notify(interaction, errorEmbed(d.message));
  } catch (inner) {
    log.warn({ err: inner instanceof Error ? inner.message : inner }, 'could not deliver error message to user');
  }
}
