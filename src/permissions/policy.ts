/** Pure data: which Discord permissions each moderation action requires (by flag NAME, mapped to bits in discordPerms.ts). */
export const MOD_ACTIONS = [
  'warn', 'timeout', 'untimeout', 'kick', 'ban', 'unban', 'removewarn', 'clearwarnings', 'lock', 'unlock', 'slowmode', 'purge',
] as const;
export type ModAction = (typeof MOD_ACTIONS)[number];

export type PermName =
  | 'KickMembers' | 'BanMembers' | 'ModerateMembers' | 'ManageChannels' | 'ManageMessages' | 'ManageRoles'
  | 'ViewChannel' | 'SendMessages' | 'ReadMessageHistory' | 'ManageGuild' | 'Administrator';

export const ACTOR_PERMS: Record<ModAction, readonly PermName[]> = {
  warn: ['ModerateMembers'],
  timeout: ['ModerateMembers'],
  untimeout: ['ModerateMembers'],
  kick: ['KickMembers'],
  ban: ['BanMembers'],
  unban: ['BanMembers'],
  removewarn: ['ModerateMembers'],
  clearwarnings: ['ModerateMembers'],
  lock: ['ManageChannels'],
  unlock: ['ManageChannels'],
  slowmode: ['ManageChannels'],
  purge: ['ManageMessages'],
};

export const BOT_PERMS: Record<ModAction, readonly PermName[]> = {
  warn: [],
  timeout: ['ModerateMembers'],
  untimeout: ['ModerateMembers'],
  kick: ['KickMembers'],
  ban: ['BanMembers'],
  unban: ['BanMembers'],
  removewarn: [],
  clearwarnings: [],
  // Discord only lets a bot grant/deny permissions it holds itself, hence SendMessages + ManageRoles for locks.
  lock: ['ViewChannel', 'ManageChannels', 'ManageRoles', 'SendMessages'],
  unlock: ['ViewChannel', 'ManageChannels', 'ManageRoles', 'SendMessages'],
  slowmode: ['ViewChannel', 'ManageChannels'],
  purge: ['ViewChannel', 'ManageMessages', 'ReadMessageHistory'],
};

/** Actions aimed at a specific user, which therefore need target/hierarchy checks. */
export const TARGETED_ACTIONS: readonly ModAction[] = ['warn', 'timeout', 'untimeout', 'kick', 'ban'];
