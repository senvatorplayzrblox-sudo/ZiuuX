export const COMMAND_KEYS = [
  'warn', 'warnings', 'removewarn', 'clearwarnings', 'kick', 'ban', 'unban', 'timeout', 'untimeout',
  'purge', 'lock', 'unlock', 'slowmode',
  'cmdconfig', 'setlogs', 'listlogs', 'aimod', 'staffpanel', 'botsettings',
  'userinfo', 'serverinfo', 'avatar', 'roleinfo', 'systemstatus',
] as const;
export type CommandKey = (typeof COMMAND_KEYS)[number];

/** Can NEVER be disabled or restricted: prevents admins (or the owner) from locking themselves out. */
export const NON_CONFIGURABLE: readonly CommandKey[] = ['cmdconfig', 'botsettings'];

export const CONFIGURABLE_KEYS: readonly CommandKey[] = COMMAND_KEYS.filter((k) => !NON_CONFIGURABLE.includes(k));

export function isCommandKey(v: unknown): v is CommandKey {
  return typeof v === 'string' && (COMMAND_KEYS as readonly string[]).includes(v);
}
export function isConfigurableKey(v: unknown): v is CommandKey {
  return isCommandKey(v) && !NON_CONFIGURABLE.includes(v);
}
