import type { BotEvent } from '../types/event.js';
import ready from './client/ready.js';
import interactionCreate from './client/interactionCreate.js';
import { clientError, clientWarn } from './client/diagnostics.js';
import { guildCreate, guildDelete } from './guild/lifecycle.js';
import { banAdd, banRemove, memberAdd, memberRemove, memberUpdate } from './guild/members.js';
import { channelCreate, channelDelete, channelUpdate, roleCreate, roleDelete, roleUpdate } from './guild/rolesChannels.js';
import { messageCreate, messageDelete, messageDeleteBulk, messageUpdate } from './message/messages.js';

export const ALL_EVENTS: BotEvent[] = [
  ready, interactionCreate, clientError, clientWarn, guildCreate, guildDelete,
  memberAdd, memberRemove, memberUpdate, banAdd, banRemove,
  roleCreate, roleUpdate, roleDelete, channelCreate, channelUpdate, channelDelete,
  messageCreate, messageUpdate, messageDelete, messageDeleteBulk,
] as unknown as BotEvent[];
