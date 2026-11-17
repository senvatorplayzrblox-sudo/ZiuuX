export const ERROR_CODES = [
  'permission_denied',
  'hierarchy',
  'bot_permission',
  'invalid_input',
  'not_found',
  'command_disabled',
  'command_restricted',
  'guild_only',
  'owner_only',
  'already_done',
  'discord_api',
  'database',
  'ai_unavailable',
  'rate_limited',
  'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
