import type { Command } from '../types/command.js';
import { warn } from './moderation/warn.js';
import { warnings } from './moderation/warnings.js';
import { removewarn } from './moderation/removewarn.js';
import { clearwarnings } from './moderation/clearwarnings.js';
import { kick } from './moderation/kick.js';
import { ban } from './moderation/ban.js';
import { unban } from './moderation/unban.js';
import { timeout } from './moderation/timeout.js';
import { untimeout } from './moderation/untimeout.js';
import { purge } from './moderation/purge.js';
import { lock } from './moderation/lock.js';
import { unlock } from './moderation/unlock.js';
import { slowmode } from './moderation/slowmode.js';
import { cmdconfig } from './config/cmdconfig.js';
import { setlogs } from './config/setlogs.js';
import { listlogs } from './config/listlogs.js';
import { aimod } from './ai/aimod.js';
import { staffpanel } from './staff/staffpanel.js';
import { botsettings } from './owner/botsettings.js';
import { userinfo } from './info/userinfo.js';
import { serverinfo } from './info/serverinfo.js';
import { avatar } from './info/avatar.js';
import { roleinfo } from './info/roleinfo.js';
import { systemstatus } from './info/systemstatus.js';

/** Explicit registry: a missing/misspelled command is a COMPILE error, and buildRegistry() verifies every command key is implemented. */
export const ALL_COMMANDS: Command[] = [
  warn, warnings, removewarn, clearwarnings, kick, ban, unban, timeout, untimeout, purge, lock, unlock, slowmode,
  cmdconfig, setlogs, listlogs, aimod, staffpanel, botsettings,
  userinfo, serverinfo, avatar, roleinfo, systemstatus,
];
