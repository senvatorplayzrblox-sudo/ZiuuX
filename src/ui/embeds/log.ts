import type { EmbedBuilder } from 'discord.js';
import { titled, field } from './base.js';
import { ts, tsBoth } from '../../utils/time.js';
import { truncate, codeBlockSafe } from '../../utils/text.js';
import { e } from '../../config/emojis.js';

const block = (text: string | null | undefined, max = 1000) => (text ? `\`\`\`\n${codeBlockSafe(truncate(text, max))}\n\`\`\`` : '*content unavailable*');

export function messageEditLog(p: { authorId: string | null; channelId: string; messageId: string; url: string; before: string | null; after: string | null }): EmbedBuilder {
  return titled('info', 'edit', 'Message edited').addFields(
    field('Author', p.authorId ? `<@${p.authorId}> (\`${p.authorId}\`)` : 'unknown', true),
    field('Channel', `<#${p.channelId}> • [Jump](${p.url})`, true),
    field('Before', block(p.before)),
    field('After', block(p.after)),
  ).setFooter({ text: `Message ID: ${p.messageId}` });
}

export function messageDeleteLog(p: { authorId: string | null; channelId: string; messageId: string; content: string | null; attachments: number; note?: string | null }): EmbedBuilder {
  const emb = titled('warning', 'delete', 'Message deleted').addFields(
    field('Author', p.authorId ? `<@${p.authorId}> (\`${p.authorId}\`)` : 'unknown', true),
    field('Channel', `<#${p.channelId}>`, true),
    field('Content', block(p.content)),
  );
  if (p.attachments > 0) emb.addFields(field('Attachments', String(p.attachments), true));
  if (p.note) emb.addFields(field('Note', p.note));
  return emb.setFooter({ text: `Message ID: ${p.messageId}` });
}

export function bulkDeleteLog(p: { channelId: string; count: number; note?: string | null }): EmbedBuilder {
  const emb = titled('warning', 'delete', 'Bulk message deletion').addFields(field('Channel', `<#${p.channelId}>`, true), field('Messages', String(p.count), true));
  if (p.note) emb.addFields(field('Note', p.note));
  return emb;
}

export function memberJoinLog(p: { userId: string; tag: string; createdAt: Date; memberCount: number; avatarUrl: string }): EmbedBuilder {
  return titled('success', 'join', 'Member joined').setThumbnail(p.avatarUrl).addFields(
    field('Member', `<@${p.userId}> (${p.tag})`, true),
    field('ID', `\`${p.userId}\``, true),
    field('Account created', tsBoth(p.createdAt)),
    field('Member count', String(p.memberCount), true),
  );
}

export function memberLeaveLog(p: { userId: string; tag: string; joinedAt: Date | null; roles: string[]; avatarUrl: string }): EmbedBuilder {
  return titled('warning', 'leave', 'Member left').setThumbnail(p.avatarUrl).addFields(
    field('Member', `<@${p.userId}> (${p.tag})`, true),
    field('ID', `\`${p.userId}\``, true),
    field('Joined', p.joinedAt ? tsBoth(p.joinedAt) : 'unknown'),
    field('Roles', p.roles.length ? truncate(p.roles.map((r) => `<@&${r}>`).join(' '), 1000) : 'None'),
  );
}

export function banLog(p: { userId: string; tag: string; reason: string | null; moderatorId: string | null; caseNumber: number | null; unban?: boolean }): EmbedBuilder {
  const emb = titled(p.unban ? 'success' : 'error', p.unban ? 'unlock' : 'ban', p.unban ? 'Member unbanned' : 'Member banned').addFields(
    field('User', `<@${p.userId}> (${p.tag})`, true),
    field('ID', `\`${p.userId}\``, true),
    field('Moderator', p.moderatorId ? `<@${p.moderatorId}>` : 'unknown (audit log unavailable)', true),
    field('Reason', p.reason ?? 'No reason provided'),
  );
  if (p.caseNumber) emb.addFields(field('Case', `#${p.caseNumber}`, true));
  return emb;
}

export function timeoutLog(p: { userId: string; tag: string; until: Date | null; moderatorId: string | null; reason: string | null; caseNumber: number | null }): EmbedBuilder {
  const emb = titled(p.until ? 'warning' : 'success', 'mute', p.until ? 'Member timed out' : 'Timeout removed').addFields(
    field('Member', `<@${p.userId}> (${p.tag})`, true),
    field('Moderator', p.moderatorId ? `<@${p.moderatorId}>` : 'unknown', true),
  );
  if (p.until) emb.addFields(field('Until', `${ts(p.until, 'F')} (${ts(p.until, 'R')})`));
  emb.addFields(field('Reason', p.reason ?? 'No reason provided'));
  if (p.caseNumber) emb.addFields(field('Case', `#${p.caseNumber}`, true));
  return emb;
}

export function memberRolesLog(p: { userId: string; tag: string; added: string[]; removed: string[]; moderatorId: string | null }): EmbedBuilder {
  const emb = titled('info', 'role', 'Member roles updated').addFields(field('Member', `<@${p.userId}> (${p.tag})`, true), field('By', p.moderatorId ? `<@${p.moderatorId}>` : 'unknown', true));
  if (p.added.length) emb.addFields(field(`${e('enabled')} Added`.trim(), p.added.map((r) => `<@&${r}>`).join(' ')));
  if (p.removed.length) emb.addFields(field(`${e('disabled')} Removed`.trim(), p.removed.map((r) => `<@&${r}>`).join(' ')));
  return emb;
}

export function roleLog(p: { kind: 'created' | 'deleted' | 'updated'; roleId: string; name: string; changes: string[]; moderatorId: string | null }): EmbedBuilder {
  const emb = titled(p.kind === 'deleted' ? 'warning' : 'info', 'role', `Role ${p.kind}`).addFields(
    field('Role', p.kind === 'deleted' ? `${p.name} (\`${p.roleId}\`)` : `<@&${p.roleId}> (${p.name})`, true),
    field('By', p.moderatorId ? `<@${p.moderatorId}>` : 'unknown', true),
  );
  if (p.changes.length) emb.addFields(field('Changes', truncate(p.changes.join('\n'), 1000)));
  return emb;
}

export function channelLog(p: { kind: 'created' | 'deleted' | 'updated'; channelId: string; name: string; type: string; changes: string[]; moderatorId: string | null }): EmbedBuilder {
  const emb = titled(p.kind === 'deleted' ? 'warning' : 'info', 'channel', `Channel ${p.kind}`).addFields(
    field('Channel', p.kind === 'deleted' ? `#${p.name} (\`${p.channelId}\`)` : `<#${p.channelId}> (${p.name})`, true),
    field('Type', p.type, true),
    field('By', p.moderatorId ? `<@${p.moderatorId}>` : 'unknown', true),
  );
  if (p.changes.length) emb.addFields(field('Changes', truncate(p.changes.join('\n'), 1000)));
  return emb;
}
