import { createHash } from 'node:crypto';
import { ButtonStyle, type Guild } from 'discord.js';
import { AI_ACTIONS, AI_CATEGORIES, CATEGORY_META, SENSITIVITIES, type AICategory, type GuildAIConfig } from '../../../config/aiCategories.js';
import { AI_MODELS } from '../../../config/aiModels.js';
import { AI_LIMITS } from '../../../config/constants.js';
import { e } from '../../../config/emojis.js';
import { AIIncidentRepo } from '../../../database/repositories/index.js';
import { effectiveThreshold } from '../../../ai/decision.js';
import { buildCustomId } from '../../../interactions/customId.js';
import type { Services } from '../../../types/services.js';
import { button, row, stringSelect, type Row, type View } from '../../components/builders.js';
import { pageButtons, paginate } from '../../components/pagination.js';
import { channelSelect, roleSelect, userSelect } from '../../components/selects.js';
import { actionLabel } from '../../embeds/ai.js';
import { field, statusIcon, titled } from '../../embeds/base.js';
import { formatDuration } from '../../../utils/duration.js';
import { truncate, sanitizeInline } from '../../../utils/text.js';
import { ts } from '../../../utils/time.js';

export const SECTIONS = ['overview', 'detection', 'actions', 'words', 'channels', 'exempt', 'health', 'incidents'] as const;
export type Section = (typeof SECTIONS)[number];
export const isSection = (v: unknown): v is Section => typeof v === 'string' && (SECTIONS as readonly string[]).includes(v);

const SECTION_META: Record<Section, { label: string; emoji: Parameters<typeof stringSelect>[2][number]['emoji']; description: string }> = {
  overview: { label: 'Overview', emoji: 'home', description: 'Status and summary' },
  detection: { label: 'Detection', emoji: 'aiDetect', description: 'Sensitivity, categories, thresholds' },
  actions: { label: 'Actions', emoji: 'shield', description: 'What happens when something is flagged' },
  words: { label: 'Blocked words', emoji: 'words', description: 'Local word and phrase list' },
  channels: { label: 'Channels', emoji: 'channel', description: 'Alert, log and scan-scope channels' },
  exempt: { label: 'Exemptions', emoji: 'role', description: 'Roles, channels and users to skip' },
  health: { label: 'Provider health', emoji: 'stats', description: 'Provider state and failures' },
  incidents: { label: 'Recent incidents', emoji: 'history', description: 'Latest detections' },
};

export const wordId = (normalized: string): string => createHash('sha1').update(normalized).digest('hex').slice(0, 16);
const WORDS_PER_PAGE = 20;
const INCIDENTS_PER_PAGE = 6;

const navRow = (current: Section): Row =>
  row(stringSelect(buildCustomId('am', 'nav'), 'AI moderation sections…', SECTIONS.map((s) => ({ label: SECTION_META[s].label, value: s, description: SECTION_META[s].description, emoji: SECTION_META[s].emoji, default: s === current }))));

const chans = (ids: string[]) => (ids.length ? ids.map((i) => `<#${i}>`).join(' ') : 'None');

export interface RenderOpts { page?: number; category?: AICategory }

export async function renderAIView(s: Services, guild: Guild, section: Section, opts: RenderOpts = {}): Promise<View> {
  const cfg = await s.aiConfig.get(guild.id);
  const sel = await s.botSettings.getAI();
  const snap = s.health.aiSnapshot(sel.provider);

  switch (section) {
    case 'overview': {
      const words = (await s.blockedWords.list(guild.id)).length;
      const embed = titled(cfg.enabled ? 'success' : 'neutral', 'ai', 'AI moderation', cfg.enabled ? 'AI moderation is **enabled** for this server.' : 'AI moderation is **disabled**. Enable it to start scanning message text.').addFields(
        field('Provider', `${AI_MODELS[sel.provider].label} • \`${sel.model}\`\n${statusIcon(snap.state === 'healthy')} ${snap.state.replace('_', ' ')}\n*Set by the bot owner.*`, true),
        field('Sensitivity', cfg.sensitivity, true),
        field('Blocked words', String(words), true),
        field('Categories', AI_CATEGORIES.map((c) => `${statusIcon(cfg.categories[c].enabled)} ${CATEGORY_META[c].label}`).join('\n'), true),
        field('Channels', `Alerts: ${cfg.alertChannelId ? `<#${cfg.alertChannelId}>` : 'none'}\nLog: ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'none'}\nScope: ${cfg.scopeChannelIds.length ? `${cfg.scopeChannelIds.length} channel(s)` : 'all channels'}`, true),
        field('Privacy & safety', 'Only message **text** is scanned and it is sent to the configured AI provider. If the AI is unavailable, nothing is moderated (fail-open). Administrators and the server owner are always exempt.'),
      );
      return { embeds: [embed], components: [navRow(section), row(
        button(buildCustomId('am', 'toggle'), cfg.enabled ? 'Disable AI moderation' : 'Enable AI moderation', cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success, cfg.enabled ? 'disabled' : 'enabled'),
        button(buildCustomId('am', 'show', 'overview'), 'Refresh', ButtonStyle.Secondary, 'refresh'),
      )] };
    }

    case 'detection': {
      const lines = AI_CATEGORIES.map((c) => `${statusIcon(cfg.categories[c].enabled)} **${CATEGORY_META[c].label}** — threshold \`${cfg.categories[c].threshold.toFixed(2)}\` (effective \`${effectiveThreshold(cfg, c).toFixed(2)}\`)`);
      const embed = titled('primary', 'aiDetect', 'Detection', lines.join('\n')).addFields(
        field('Sensitivity', `**${cfg.sensitivity}**: low raises every threshold by 0.10, high lowers it by 0.10.`),
        field('Safeguards (fixed)', `Warn/timeout need confidence ≥ ${AI_LIMITS.punitiveMinConfidence} **and** score ≥ ${AI_LIMITS.punitiveMinScore}; otherwise the action is downgraded to log-only. Self-harm is alert-only.`),
      );
      return { embeds: [embed], components: [
        navRow(section),
        row(stringSelect(buildCustomId('am', 'sens'), 'Sensitivity', SENSITIVITIES.map((x) => ({ label: x[0]!.toUpperCase() + x.slice(1), value: x, default: x === cfg.sensitivity })))),
        row(stringSelect(buildCustomId('am', 'cats'), 'Categories to detect', AI_CATEGORIES.map((c) => ({ label: CATEGORY_META[c].label, value: c, description: CATEGORY_META[c].description, default: cfg.categories[c].enabled })), { min: 0, max: AI_CATEGORIES.length })),
        row(stringSelect(buildCustomId('am', 'thrpick'), 'Edit a category threshold…', AI_CATEGORIES.map((c) => ({ label: `${CATEGORY_META[c].label} (${cfg.categories[c].threshold.toFixed(2)})`, value: c, emoji: 'edit' as const })))),
      ] };
    }

    case 'actions': {
      if (opts.category) {
        const c = opts.category;
        const embed = titled('primary', 'shield', `Action: ${CATEGORY_META[c].label}`, `Currently: **${actionLabel(cfg.categories[c].action)}**\n\n• **Log only**: record the incident, nothing visible.\n• **Delete**: remove the message.\n• **Warn**: warn the member (case + DM).\n• **Timeout**: time the member out (${formatDuration(cfg.timeoutSeconds * 1000)}).\n\nWarn and timeout are downgraded to log-only when the AI is not confident.`);
        return { embeds: [embed], components: [
          navRow(section),
          row(stringSelect(buildCustomId('am', 'act', c), 'Action', AI_ACTIONS.map((a) => ({ label: actionLabel(a), value: a, default: a === cfg.categories[c].action })))),
          row(button(buildCustomId('am', 'show', 'actions'), 'Back', ButtonStyle.Secondary, 'back')),
        ] };
      }
      const lines = AI_CATEGORIES.map((c) => `${e(CATEGORY_META[c].alertOnly ? 'warning' : 'shield')} **${CATEGORY_META[c].label}** → ${CATEGORY_META[c].alertOnly ? 'Alert staff only (fixed)' : actionLabel(cfg.categories[c].action)}`);
      const embed = titled('primary', 'shield', 'Actions', lines.join('\n')).addFields(
        field('Blocked words', actionLabel(cfg.blockedWordAction), true),
        field('Timeout length', formatDuration(cfg.timeoutSeconds * 1000), true),
        field('Delete message on warn/timeout', cfg.deleteOnPunish ? 'Yes' : 'No', true),
      );
      return { embeds: [embed], components: [
        navRow(section),
        row(stringSelect(buildCustomId('am', 'actpick'), 'Change the action for a category…', AI_CATEGORIES.filter((c) => !CATEGORY_META[c].alertOnly).map((c) => ({ label: CATEGORY_META[c].label, value: c, description: actionLabel(cfg.categories[c].action), emoji: 'edit' as const })))),
        row(stringSelect(buildCustomId('am', 'bwact'), 'Action for blocked words', AI_ACTIONS.map((a) => ({ label: actionLabel(a), value: a, default: a === cfg.blockedWordAction })))),
        row(button(buildCustomId('am', 'timeoutbtn'), 'Set timeout length', ButtonStyle.Secondary, 'mute'), button(buildCustomId('am', 'dop'), cfg.deleteOnPunish ? 'Keep messages on warn/timeout' : 'Delete messages on warn/timeout', ButtonStyle.Secondary, 'delete')),
      ] };
    }

    case 'words': {
      const all = await s.blockedWords.list(guild.id);
      const p = paginate(all, opts.page ?? 0, WORDS_PER_PAGE);
      const embed = titled('primary', 'words', 'Blocked words and phrases', p.total ? p.items.map((w) => `• ||${sanitizeInline(w.term)}|| *(${w.matchMode})*`).join('\n') : 'No blocked words yet.').addFields(
        field('How matching works', '**word**: whole words/phrases only (case, accents and zero-width characters ignored). **contains**: matches inside other words. Matching is local, so it keeps working even if the AI provider is down. Action: ' + actionLabel(cfg.blockedWordAction)),
      ).setFooter({ text: `ZiuuX • ${p.total} term(s) • page ${p.page + 1}/${p.pages}` });
      const comps: Row[] = [navRow(section)];
      if (p.items.length) comps.push(row(stringSelect(buildCustomId('am', 'bwrm', p.page), 'Remove a word…', p.items.map((w) => ({ label: truncate(w.term, 90), value: wordId(w.normalized), emoji: 'delete' as const })))));
      comps.push(row(button(buildCustomId('am', 'bwadd'), 'Add words', ButtonStyle.Success, 'words'), ...pageButtons(p.page, p.pages, (n) => buildCustomId('am', 'bwpage', n))));
      return { embeds: [embed], components: comps };
    }

    case 'channels': {
      const embed = titled('primary', 'channel', 'Channels', '').addFields(
        field('Alert channel', cfg.alertChannelId ? `<#${cfg.alertChannelId}>` : 'Not set', true),
        field('Log channel', cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'Not set', true),
        field('Scan scope', cfg.scopeChannelIds.length ? chans(cfg.scopeChannelIds) : 'All channels (except exemptions)'),
        field('What these do', 'The **alert** channel receives self-harm alerts (falls back to the log channel). The **log** channel receives every AI/blocked-word incident. **Scope** limits scanning to the chosen channels; leave empty to scan everywhere.'),
      );
      return { embeds: [embed], components: [
        navRow(section),
        row(channelSelect(buildCustomId('am', 'alertch'), 'Alert channel', cfg.alertChannelId ? [cfg.alertChannelId] : [], guild, { max: 1 })),
        row(channelSelect(buildCustomId('am', 'logch'), 'Log channel', cfg.logChannelId ? [cfg.logChannelId] : [], guild, { max: 1 })),
        row(channelSelect(buildCustomId('am', 'scope'), 'Scan scope (empty = all channels)', cfg.scopeChannelIds, guild)),
        row(button(buildCustomId('am', 'clearalert'), 'Clear alert', ButtonStyle.Secondary, 'reset', !cfg.alertChannelId), button(buildCustomId('am', 'clearlog'), 'Clear log', ButtonStyle.Secondary, 'reset', !cfg.logChannelId), button(buildCustomId('am', 'clearscope'), 'Clear scope', ButtonStyle.Secondary, 'reset', cfg.scopeChannelIds.length === 0)),
      ] };
    }

    case 'exempt': {
      const embed = titled('primary', 'role', 'Exemptions', 'Exempt members/channels are never scanned or moderated. The server owner and members with **Administrator** are always exempt.').addFields(
        field('Roles', cfg.exemptRoleIds.length ? cfg.exemptRoleIds.map((i) => `<@&${i}>`).join(' ') : 'None'),
        field('Channels', chans(cfg.exemptChannelIds)),
        field('Users', cfg.exemptUserIds.length ? cfg.exemptUserIds.map((i) => `<@${i}>`).join(' ') : 'None'),
      );
      return { embeds: [embed], components: [
        navRow(section),
        row(roleSelect(buildCustomId('am', 'exroles'), 'Exempt roles', cfg.exemptRoleIds, guild)),
        row(channelSelect(buildCustomId('am', 'exch'), 'Exempt channels', cfg.exemptChannelIds, guild)),
        row(userSelect(buildCustomId('am', 'exusers'), 'Exempt users', cfg.exemptUserIds, { min: 0, max: 25 })),
      ] };
    }

    case 'health': {
      const embed = titled(snap.state === 'healthy' ? 'success' : snap.state === 'degraded' ? 'warning' : 'neutral', 'stats', 'AI provider health', 'Provider and model are chosen by the bot owner. **Fail-open is fixed:** if classification fails, times out, is rate-limited or returns invalid output, no moderation action is taken.');
      for (const id of Object.keys(AI_MODELS) as Array<keyof typeof AI_MODELS>) {
        const h = s.health.aiSnapshot(id);
        const active = id === sel.provider;
        embed.addFields(field(`${statusIcon(h.state === 'healthy')} ${AI_MODELS[id].label}${active ? ' (active)' : ''}`, [
          `Key: ${s.providers.isConfigured(id) ? 'configured' : 'not configured'}`,
          `State: **${h.state.replace('_', ' ')}** • breaker: ${h.breaker}`,
          `Calls: ${h.successes} ok / ${h.failures} failed • recent failure rate ${(h.recentFailureRatio * 100).toFixed(0)}%`,
          h.lastSuccessAt ? `Last success: ${ts(h.lastSuccessAt, 'R')}` : 'Last success: never',
          h.lastFailureAt ? `Last failure: ${ts(h.lastFailureAt, 'R')}` : '',
        ].filter(Boolean).join('\n'), true));
      }
      const st = s.aiModeration.stats;
      embed.addFields(field('This session', `Scanned ${st.scanned} • flagged ${st.flagged} • failed open ${st.failOpen} • skipped (rate limit) ${st.skippedRateLimit} • skipped (queue full) ${st.skippedQueueFull} • queue depth ${s.aiModeration.queueDepth}`));
      return { embeds: [embed], components: [navRow(section), row(button(buildCustomId('am', 'show', 'health'), 'Refresh', ButtonStyle.Secondary, 'refresh'))] };
    }

    case 'incidents': {
      const total = await AIIncidentRepo.count(guild.id);
      const pages = Math.max(1, Math.ceil(total / INCIDENTS_PER_PAGE));
      const page = Math.min(Math.max(0, opts.page ?? 0), pages - 1);
      const items = await AIIncidentRepo.listRecent(guild.id, page * INCIDENTS_PER_PAGE, INCIDENTS_PER_PAGE);
      const embed = titled('primary', 'history', 'Recent incidents', items.length ? '' : 'No incidents recorded. (Incidents are kept for 90 days.)');
      if (items.length) embed.addFields(items.map((i) => field(`${ts(i.createdAt, 'R')} • ${i.source === 'blocked_word' ? 'blocked word' : CATEGORY_META[i.category as AICategory]?.label ?? i.category}`, truncate(`<@${i.userId}> in <#${i.channelId}>\n${i.actionTaken} — ${i.actionResult}${i.score !== null ? ` • score ${i.score.toFixed(2)}` : ''}${i.caseNumber ? ` • case #${i.caseNumber}` : ''}\n> ${sanitizeInline(i.excerpt).slice(0, 120)}`, 1000))));
      embed.setFooter({ text: `ZiuuX • ${total} incident(s) • page ${page + 1}/${pages}` });
      return { embeds: [embed], components: [navRow(section), row(...pageButtons(page, pages, (n) => buildCustomId('am', 'inc', n)))] };
    }
  }
}
