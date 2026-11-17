import type { CommandKey } from '../config/commandKeys.js';
import { NON_CONFIGURABLE } from '../config/commandKeys.js';

export interface CommandRule {
  commandKey: string;
  enabled: boolean;
  roleIds: string[];
  channelIds: string[];
}

export type AccessResult = { allowed: true } | { allowed: false; code: 'command_disabled' | 'command_restricted'; message: string };

/**
 * PURE /cmdconfig enforcement. Restrictions only NARROW access (they never grant Discord permissions) and apply
 * to everyone, including administrators and the bot owner. Non-configurable commands are always allowed.
 * `channelIds` should contain the channel id plus (for threads) the parent channel id.
 */
export function evaluateCommandAccess(
  key: CommandKey,
  rule: CommandRule | undefined,
  memberRoleIds: readonly string[],
  channelIds: readonly string[],
): AccessResult {
  if (NON_CONFIGURABLE.includes(key) || !rule) return { allowed: true };
  if (!rule.enabled) {
    return { allowed: false, code: 'command_disabled', message: `\`/${key}\` has been disabled by the server's administrators.` };
  }
  if (rule.roleIds.length > 0 && !rule.roleIds.some((r) => memberRoleIds.includes(r))) {
    return { allowed: false, code: 'command_restricted', message: `\`/${key}\` is restricted to specific roles, and you do not have one of them.` };
  }
  if (rule.channelIds.length > 0 && !rule.channelIds.some((c) => channelIds.includes(c))) {
    return { allowed: false, code: 'command_restricted', message: `\`/${key}\` cannot be used in this channel.` };
  }
  return { allowed: true };
}
