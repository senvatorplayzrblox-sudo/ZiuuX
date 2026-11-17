import type { ErrorCode } from './errorCodes.js';

/**
 * Expected, user-facing failure. `userMessage` is safe to show; `detail` is for internal logs only.
 */
export class BotError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly userMessage: string,
    public readonly detail?: string,
    options?: { cause?: unknown },
  ) {
    super(detail ?? userMessage, options);
    this.name = 'BotError';
  }
}

export const isBotError = (e: unknown): e is BotError => e instanceof BotError;
