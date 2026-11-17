import type { EmojiKey } from './emojis.js';

export const LOG_CATEGORIES = [
  'messageEdit',
  'messageDelete',
  'memberJoin',
  'memberLeave',
  'ban',
  'unban',
  'timeout',
  'roleChange',
  'channelChange',
  'moderation',
] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const LOG_CATEGORY_META: Record<LogCategory, { label: string; emoji: EmojiKey; description: string }> = {
  messageEdit: { label: 'Message edits', emoji: 'edit', description: 'Edited messages (before / after).' },
  messageDelete: { label: 'Message deletions', emoji: 'delete', description: 'Deleted messages and bulk deletions.' },
  memberJoin: { label: 'Member joins', emoji: 'join', description: 'Members joining the server.' },
  memberLeave: { label: 'Member leaves', emoji: 'leave', description: 'Members leaving the server.' },
  ban: { label: 'Bans', emoji: 'ban', description: 'Members banned.' },
  unban: { label: 'Unbans', emoji: 'unlock', description: 'Members unbanned.' },
  timeout: { label: 'Timeouts', emoji: 'mute', description: 'Timeouts applied or removed.' },
  roleChange: { label: 'Role changes', emoji: 'role', description: 'Roles created/edited/deleted and member role changes.' },
  channelChange: { label: 'Channel changes', emoji: 'channel', description: 'Channels created, edited or deleted.' },
  moderation: { label: 'Moderation actions', emoji: 'shield', description: 'ZiuuX moderation cases (warn, kick, ban, purge, ...).' },
};

export function isLogCategory(v: unknown): v is LogCategory {
  return typeof v === 'string' && (LOG_CATEGORIES as readonly string[]).includes(v);
}
