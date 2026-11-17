import type { EmbedBuilder } from 'discord.js';
import type { CaseDoc, CaseType } from '../../types/moderation.js';
import type { EmojiKey } from '../../config/emojis.js';
import { titled, field } from './base.js';
import { formatDuration } from '../../utils/duration.js';
import { ts } from '../../utils/time.js';

export const CASE_EMOJI: Record<CaseType, EmojiKey> = {
  warn: 'warn', kick: 'kick', ban: 'ban', unban: 'unlock', timeout: 'mute', untimeout: 'enabled', purge: 'delete',
  lock: 'lock', unlock: 'unlock', slowmode: 'settings', removewarn: 'reset', clearwarnings: 'reset',
};
export const CASE_LABEL: Record<CaseType, string> = {
  warn: 'Warn', kick: 'Kick', ban: 'Ban', unban: 'Unban', timeout: 'Timeout', untimeout: 'Timeout removed', purge: 'Purge',
  lock: 'Channel locked', unlock: 'Channel unlocked', slowmode: 'Slowmode', removewarn: 'Warning removed', clearwarnings: 'Warnings cleared',
};

function details(c: CaseDoc): string[] {
  const m = c.metadata ?? {};
  const out: string[] = [];
  if (typeof m.durationMs === 'number') out.push(`**Duration:** ${formatDuration(m.durationMs)}`);
  if (typeof m.channelId === 'string') out.push(`**Channel:** <#${m.channelId}>`);
  if (typeof m.deleted === 'number') out.push(`**Deleted:** ${m.deleted} message(s)`);
  if (typeof m.seconds === 'number') out.push(`**Slowmode:** ${m.seconds === 0 ? 'off' : `${m.seconds}s`}`);
  if (typeof m.warningCase === 'number') out.push(`**Warning case:** #${m.warningCase}`);
  if (typeof m.cleared === 'number') out.push(`**Warnings cleared:** ${m.cleared}`);
  if (typeof m.deleteDays === 'number' && m.deleteDays > 0) out.push(`**Message history deleted:** ${m.deleteDays}d`);
  if (typeof m.aiCategory === 'string') out.push(`**AI category:** ${m.aiCategory}`);
  return out;
}

export function caseEmbed(c: CaseDoc): EmbedBuilder {
  const embed = titled('mod', CASE_EMOJI[c.type], `Case #${c.caseNumber} • ${CASE_LABEL[c.type]}`);
  const fields = [];
  if (c.targetId) fields.push(field('Target', `<@${c.targetId}> (\`${c.targetId}\`)`, true));
  fields.push(field('Moderator', `<@${c.moderatorId}>`, true));
  if (c.source !== 'manual') fields.push(field('Source', c.source === 'panel' ? 'Staff panel' : c.source === 'ai' ? 'AI moderation' : 'Blocked word', true));
  const d = details(c);
  if (d.length) fields.push(field('Details', d.join('\n')));
  fields.push(field('Reason', c.reason ?? 'No reason provided'));
  if (c.dmDelivered !== null && c.dmDelivered !== undefined) fields.push(field('DM notice', c.dmDelivered ? 'Delivered' : 'Could not be delivered', true));
  return embed.addFields(fields);
}

/** One compact line for lists/history. */
export function caseLine(c: CaseDoc): string {
  const reason = c.reason ? ` — ${c.reason.length > 60 ? c.reason.slice(0, 59) + '…' : c.reason}` : '';
  return `**#${c.caseNumber}** ${CASE_LABEL[c.type]}${c.targetId ? ` • <@${c.targetId}>` : ''} • ${ts(c.createdAt, 'R')}${reason}`;
}

/** Notice sent to the affected user. Never includes moderator identity beyond what the guild chooses to show. */
export function dmEmbed(opts: { guildName: string; type: 'warn' | 'kick' | 'ban' | 'timeout'; reason: string | null; durationMs?: number; caseNumber?: number }): EmbedBuilder {
  const verb = { warn: 'warned in', kick: 'kicked from', ban: 'banned from', timeout: 'timed out in' }[opts.type];
  const embed = titled(opts.type === 'warn' ? 'warning' : 'error', CASE_EMOJI[opts.type], `You were ${verb} ${opts.guildName}`);
  const f = [field('Reason', opts.reason ?? 'No reason provided')];
  if (opts.durationMs) f.push(field('Duration', formatDuration(opts.durationMs), true));
  return embed.addFields(f);
}
