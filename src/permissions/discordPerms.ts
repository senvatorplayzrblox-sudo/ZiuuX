import { PermissionFlagsBits, type Guild, type GuildMember } from 'discord.js';
import type { PermName } from './policy.js';
import type { PrincipalInfo } from './hierarchy.js';

export const permBit = (name: PermName): bigint => PermissionFlagsBits[name];

export function hasAllPerms(perms: { has(bit: bigint): boolean } | null | undefined, names: readonly PermName[]): boolean {
  if (!perms) return false;
  return names.every((n) => perms.has(permBit(n)));
}

export function memberPrincipal(guild: Guild, member: GuildMember): PrincipalInfo {
  return { id: member.id, isGuildOwner: guild.ownerId === member.id, highestRolePosition: member.roles.highest.position };
}

/** For users who are not (or may not be) members, e.g. banning by ID. */
export function userPrincipal(guild: Guild, userId: string): PrincipalInfo {
  return { id: userId, isGuildOwner: guild.ownerId === userId, highestRolePosition: -1 };
}
