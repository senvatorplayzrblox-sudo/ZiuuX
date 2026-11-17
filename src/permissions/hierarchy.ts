export interface PrincipalInfo {
  id: string;
  /** True only for the actual Discord guild owner. */
  isGuildOwner: boolean;
  /** Highest role position; -1 for users who are not members of the guild. */
  highestRolePosition: number;
}

export type DenyCode =
  | 'actor_missing_permission'
  | 'bot_missing_permission'
  | 'target_is_self'
  | 'target_is_bot'
  | 'target_is_guild_owner'
  | 'actor_hierarchy'
  | 'bot_hierarchy'
  | 'target_not_manageable';

export type PermissionResult = { allowed: true } | { allowed: false; code: DenyCode };

export interface ModerationCheckInput {
  actor: PrincipalInfo;
  bot: PrincipalInfo;
  /** null for actions with no user target (unban of a non-member is passed as a position -1 principal). */
  target: PrincipalInfo | null;
  actorHasPermission: boolean;
  botHasPermission: boolean;
  /** Discord's own moderatable/bannable/kickable verdict, when the target is a cached member. */
  platformManageable?: boolean | null;
}

/**
 * PURE moderation authorisation. There is deliberately NO parameter for the ZiuuX bot owner:
 * the owner gets exactly the same treatment as any other user here.
 */
export function evaluateModeration(i: ModerationCheckInput): PermissionResult {
  if (!i.actorHasPermission) return { allowed: false, code: 'actor_missing_permission' };
  if (!i.botHasPermission) return { allowed: false, code: 'bot_missing_permission' };
  if (!i.target) return { allowed: true };

  if (i.target.id === i.actor.id) return { allowed: false, code: 'target_is_self' };
  if (i.target.id === i.bot.id) return { allowed: false, code: 'target_is_bot' };
  if (i.target.isGuildOwner) return { allowed: false, code: 'target_is_guild_owner' };

  // The guild owner may act on anyone below them (Discord's own rule); everyone else needs a strictly higher role.
  if (!i.actor.isGuildOwner && !(i.actor.highestRolePosition > i.target.highestRolePosition)) {
    return { allowed: false, code: 'actor_hierarchy' };
  }
  if (!(i.bot.highestRolePosition > i.target.highestRolePosition)) return { allowed: false, code: 'bot_hierarchy' };
  if (i.platformManageable === false) return { allowed: false, code: 'target_not_manageable' };
  return { allowed: true };
}

export function evaluateChannelAction(i: { actorHasPermission: boolean; botHasPermission: boolean }): PermissionResult {
  if (!i.actorHasPermission) return { allowed: false, code: 'actor_missing_permission' };
  if (!i.botHasPermission) return { allowed: false, code: 'bot_missing_permission' };
  return { allowed: true };
}

export const DENY_MESSAGES: Record<DenyCode, string> = {
  actor_missing_permission: 'You do not have the Discord permission required for this action.',
  bot_missing_permission: 'I am missing a Discord permission required for this action. Please check my role and channel permissions.',
  target_is_self: 'You cannot target yourself.',
  target_is_bot: 'I cannot take this action against myself.',
  target_is_guild_owner: 'The server owner cannot be targeted.',
  actor_hierarchy: 'You cannot act on a member whose highest role is equal to or above yours.',
  bot_hierarchy: 'I cannot act on a member whose highest role is equal to or above mine. Move my role higher.',
  target_not_manageable: 'Discord does not allow this action on that member (for example, an administrator).',
};
