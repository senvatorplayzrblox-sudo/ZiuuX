import type { EmbedBuilder } from 'discord.js';
import { titled, field } from './base.js';
import { CATEGORY_META, type AIAction, type AICategory } from '../../config/aiCategories.js';
import { truncate, sanitizeInline } from '../../utils/text.js';

export function aiIncidentEmbed(p: {
  userId: string; channelId: string; messageUrl: string | null; source: 'ai' | 'blocked_word'; category: string; score: number | null; confidence: number | null;
  configuredAction: string; actionTaken: string; actionResult: string; excerpt: string; provider?: string | null; model?: string | null; downgradeReason?: string | null; caseNumber?: number | null;
}): EmbedBuilder {
  const label = p.source === 'blocked_word' ? 'Blocked word' : CATEGORY_META[p.category as AICategory]?.label ?? p.category;
  const emb = titled('warning', p.source === 'blocked_word' ? 'words' : 'aiDetect', `AI moderation • ${label}`).addFields(
    field('User', `<@${p.userId}> (\`${p.userId}\`)`, true),
    field('Channel', `<#${p.channelId}>${p.messageUrl ? ` • [Jump](${p.messageUrl})` : ''}`, true),
  );
  if (p.score !== null) emb.addFields(field('Score / confidence', `${p.score.toFixed(2)} / ${p.confidence?.toFixed(2) ?? 'n/a'}`, true));
  emb.addFields(
    field('Action', `${p.actionTaken}${p.actionTaken !== p.configuredAction ? ` (configured: ${p.configuredAction})` : ''} — ${p.actionResult}`),
  );
  if (p.downgradeReason) emb.addFields(field('Safeguard', p.downgradeReason));
  if (p.caseNumber) emb.addFields(field('Case', `#${p.caseNumber}`, true));
  if (p.provider) emb.addFields(field('Model', `${p.provider} / ${p.model ?? '?'}`, true));
  emb.addFields(field('Excerpt', truncate(sanitizeInline(p.excerpt), 300) || '*empty*'));
  return emb;
}

export function selfHarmAlertEmbed(p: { userId: string; channelId: string; messageUrl: string | null; score: number; excerpt: string }): EmbedBuilder {
  return titled('warning', 'warning', 'Possible self-harm content flagged').setDescription(
    'This is an **alert only**. No action was taken against the member and the message was not removed. ' +
      'Please consider reaching out to them with care rather than moderating them.',
  ).addFields(
    field('Member', `<@${p.userId}> (\`${p.userId}\`)`, true),
    field('Channel', `<#${p.channelId}>${p.messageUrl ? ` • [Jump](${p.messageUrl})` : ''}`, true),
    field('Score', p.score.toFixed(2), true),
    field('Excerpt', truncate(sanitizeInline(p.excerpt), 300) || '*empty*'),
  );
}

export const actionLabel = (a: AIAction | 'alert' | 'none') =>
  ({ log: 'Log only', delete: 'Delete message', warn: 'Warn user', timeout: 'Timeout user', alert: 'Alert staff', none: 'None' })[a];
