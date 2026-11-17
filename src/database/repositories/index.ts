export { GuildSettingsRepo } from './guildSettings.js';
export { CaseRepo, type NewCase } from './cases.js';
export { WarningRepo } from './warnings.js';
export { ChannelLockRepo } from './channelLocks.js';
export { LogConfigRepo } from './logConfig.js';
export { CommandConfigRepo } from './commandConfig.js';
export { AIConfigRepo } from './aiConfig.js';
export { BlockedWordRepo } from './blockedWords.js';
export { AIIncidentRepo } from './aiIncidents.js';
export { StaffPanelConfigRepo } from './staffPanelConfig.js';
export { BotSettingsRepo, OwnerAuditRepo, AIProviderHealthRepo } from './global.js';

import { GuildSettingsRepo } from './guildSettings.js';
import { CaseRepo } from './cases.js';
import { WarningRepo } from './warnings.js';
import { ChannelLockRepo } from './channelLocks.js';
import { LogConfigRepo } from './logConfig.js';
import { CommandConfigRepo } from './commandConfig.js';
import { AIConfigRepo } from './aiConfig.js';
import { BlockedWordRepo } from './blockedWords.js';
import { AIIncidentRepo } from './aiIncidents.js';
import { StaffPanelConfigRepo } from './staffPanelConfig.js';

/** Every guild-owned repository, used by the retention sweep. GuildSettings goes last. */
export const GUILD_SCOPED_REPOS: Array<{ name: string; deleteGuildData(guildId: string): Promise<void> }> = [
  { name: 'cases', ...CaseRepo },
  { name: 'warnings', ...WarningRepo },
  { name: 'channelLocks', ...ChannelLockRepo },
  { name: 'logConfig', ...LogConfigRepo },
  { name: 'commandConfig', ...CommandConfigRepo },
  { name: 'aiConfig', ...AIConfigRepo },
  { name: 'blockedWords', ...BlockedWordRepo },
  { name: 'aiIncidents', ...AIIncidentRepo },
  { name: 'staffPanelConfig', ...StaffPanelConfigRepo },
  { name: 'guildSettings', ...GuildSettingsRepo },
];
