import { ButtonStyle, type Guild, type GuildMember, type User } from 'discord.js';
import { CASE_TYPES, type CaseDoc, type CaseType } from '../../../types/moderation.js';
import { buildCustomId } from '../../../interactions/customId.js';
import type { Services } from '../../../types/services.js';
import { button, row, stringSelect, type View } from '../../components/builders.js';
import { pageButtons } from '../../components/pagination.js';
import { channelSelect, roleSelect, userSelect } from '../../components/selects.js';
import { CASE_LABEL, caseLine } from '../../embeds/case.js';
import { field, titled } from '../../embeds/base.js';
import { LIMITS } from '../../../config/constants.js';
import { AI_MODELS } from '../../../config/aiModels.js';
import { resolveBot } from '../../../core/access.js';
import { tsBoth } from '../../../utils/time.js';
import { truncate } from '../../../utils/text.js';
import { formatDuration } from '../../../utils/duration.js';

const home = () => button(buildCustomId('sp', 'nav', 'home'), 'Home', ButtonStyle.Secondary, 'home');

export async function homeView(s: Services, guild: Guild): Promise<View> {
  const [ov, ai, sel] = await Promise.all([s.cases.overview(guild.id), s.aiConfig.get(guild.id), s.botSettings.getAI()]);
  const snap = s.health.aiSnapshot(sel.provider);
  const embed = titled('primary', 'staff', 'Staff panel', 'Moderation tools for this server. Every action re-checks your permissions, role hierarchy and `/cmdconfig` restrictions.').addFields(
    field('Cases (24h)', String(ov.cases24h), true),
    field('Cases (7d)', String(ov.cases7d), true),
    field('Cases (all time)', String(ov.totalCases), true),
    field('Active warnings', String(ov.activeWarnings), true),
    field('AI moderation', `${ai.enabled ? 'Enabled' : 'Disabled'} • ${AI_MODELS[sel.provider].label} ${snap.state.replace('_', ' ')}`, true),
  );
  return { embeds: [embed], components: [row(
    button(buildCustomId('sp', 'nav', 'members'), 'Member tools', ButtonStyle.Primary, 'user'),
    button(buildCustomId('sp', 'nav', 'channels'), 'Channel tools', ButtonStyle.Primary, 'channel'),
    button(buildCustomId('sp', 'nav', 'cases'), 'Recent cases', ButtonStyle.Secondary, 'history'),
    button(buildCustomId('sp', 'nav', 'settings'), 'Panel settings', ButtonStyle.Secondary, 'settings'),
    button(buildCustomId('sp', 'nav', 'home'), 'Refresh', ButtonStyle.Secondary, 'refresh'),
  )] };
}

export function membersView(): View {
  return {
    embeds: [titled('primary', 'user', 'Member tools', 'Select a member to view their moderation card.')],
    components: [row(userSelect(buildCustomId('sp', 'pickuser'), 'Select a member…')), row(home())],
  };
}

export async function cardView(s: Services, guild: Guild, actor: GuildMember, user: User, member: GuildMember | null): Promise<View> {
  const [active, history] = await Promise.all([s.warnings.countActive(guild.id, user.id), s.cases.historyFor(guild.id, user.id, 5)]);
  const embed = titled('primary', 'user', `${user.tag}`).setThumbnail((member ?? user).displayAvatarURL({ size: 128 })).addFields(
    field('Member', `<@${user.id}>\n\`${user.id}\``, true),
    field('Active warnings', String(active), true),
    field('In server', member ? 'Yes' : 'No (ban/history only)', true),
  );
  if (member) {
    embed.addFields(field('Joined', member.joinedAt ? tsBoth(member.joinedAt) : 'unknown'));
    if (member.isCommunicationDisabled()) embed.addFields(field('Timed out until', tsBoth(member.communicationDisabledUntil)));
  }
  embed.addFields(field('Recent cases', history.length ? history.map(caseLine).join('\n') : 'None'));

  // Buttons are disabled when the action would be denied; this is only UX, the click re-checks authoritatively.
  const bot = await resolveBot(guild);
  const can = (action: 'warn' | 'timeout' | 'kick' | 'ban') => !!member || action === 'ban' ? s.permissions.checkModeration({ guild, actor, bot, target: member ?? { id: user.id }, action }).allowed : false;
  const id = (a: string) => buildCustomId('sp', 'act', a, user.id);
  return {
    embeds: [embed],
    components: [
      row(
        button(id('warn'), 'Warn', ButtonStyle.Secondary, 'warn', !can('warn')),
        button(id('timeout'), 'Timeout', ButtonStyle.Secondary, 'mute', !can('timeout')),
        button(id('kick'), 'Kick', ButtonStyle.Danger, 'kick', !can('kick')),
        button(id('ban'), 'Ban', ButtonStyle.Danger, 'ban', !can('ban')),
      ),
      row(
        button(buildCustomId('sp', 'hist', user.id), 'History', ButtonStyle.Secondary, 'history'),
        button(buildCustomId('sp', 'rmpick', user.id), 'Remove warning', ButtonStyle.Secondary, 'reset', active === 0),
        button(buildCustomId('sp', 'clr', user.id), 'Clear warnings', ButtonStyle.Secondary, 'delete', active === 0),
        button(buildCustomId('sp', 'card', user.id), 'Refresh', ButtonStyle.Secondary, 'refresh'),
      ),
      row(button(buildCustomId('sp', 'nav', 'members'), 'Back', ButtonStyle.Secondary, 'back'), home()),
    ],
  };
}

export async function historyView(s: Services, guild: Guild, user: User): Promise<View> {
  const items: CaseDoc[] = await s.cases.historyFor(guild.id, user.id, LIMITS.historyEntries);
  const embed = titled('primary', 'history', `History: ${user.tag}`, items.length ? items.map(caseLine).join('\n') : 'No moderation history in this server.').setFooter({ text: `ZiuuX • last ${LIMITS.historyEntries} cases` });
  return { embeds: [embed], components: [row(button(buildCustomId('sp', 'card', user.id), 'Back', ButtonStyle.Secondary, 'back'), home())] };
}

export async function removeWarnView(s: Services, guild: Guild, user: User): Promise<View> {
  const list = await s.warnings.list(guild.id, user.id, { activeOnly: true, limit: 25 });
  const back = row(button(buildCustomId('sp', 'card', user.id), 'Back', ButtonStyle.Secondary, 'back'));
  if (list.length === 0) return { embeds: [titled('primary', 'warn', 'Remove a warning', `${user.tag} has no active warnings.`)], components: [back] };
  return {
    embeds: [titled('primary', 'warn', 'Remove a warning', `Pick a warning to remove for ${user.tag}.`)],
    components: [row(stringSelect(buildCustomId('sp', 'rmwarn', user.id), 'Select a warning…', list.map((w) => ({ label: `#${w.caseNumber}: ${truncate(w.reason ?? 'No reason', 60)}`, value: String(w.caseNumber), description: `Issued ${w.createdAt.toISOString().slice(0, 10)}`, emoji: 'warn' as const })))), back],
  };
}

export function confirmClearView(user: User): View {
  return {
    embeds: [titled('warning', 'warning', 'Clear all warnings?', `This deactivates **all active warnings** for <@${user.id}> and records a case.`)],
    components: [row(button(buildCustomId('sp', 'clrok', user.id), 'Confirm clear', ButtonStyle.Danger, 'delete'), button(buildCustomId('sp', 'card', user.id), 'Cancel', ButtonStyle.Secondary, 'back'))],
  };
}

export function channelsView(currentChannelId: string, guild: Guild): View {
  return {
    embeds: [titled('primary', 'channel', 'Channel tools', 'Select a channel, or use the one you are in.')],
    components: [row(channelSelect(buildCustomId('sp', 'pickch'), 'Select a channel…', [], guild, { max: 1, min: 1 })), row(button(buildCustomId('sp', 'ch', currentChannelId), 'This channel', ButtonStyle.Primary, 'channel'), home())],
  };
}

export async function channelCardView(s: Services, guild: Guild, channelId: string): Promise<View> {
  const ch = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
  if (!ch) return { embeds: [titled('error', 'error', 'Channel not found', 'That channel no longer exists.')], components: [row(button(buildCustomId('sp', 'nav', 'channels'), 'Back', ButtonStyle.Secondary, 'back'))] };
  const locked = await s.locks.isLocked(guild.id, channelId);
  const slow = 'rateLimitPerUser' in ch && typeof ch.rateLimitPerUser === 'number' ? ch.rateLimitPerUser : null;
  const embed = titled('primary', 'channel', `#${ch.name}`).addFields(
    field('Channel', `<#${ch.id}>`, true),
    field('Locked by ZiuuX', locked ? 'Yes' : 'No', true),
    field('Slowmode', slow === null ? 'n/a' : slow === 0 ? 'Off' : formatDuration(slow * 1000), true),
  );
  const id = (a: string) => buildCustomId('sp', 'chact', a, channelId);
  return {
    embeds: [embed],
    components: [
      row(button(id('lock'), 'Lock', ButtonStyle.Danger, 'lock', locked), button(id('unlock'), 'Unlock', ButtonStyle.Success, 'unlock', !locked), button(id('slowmode'), 'Slowmode', ButtonStyle.Secondary, 'settings'), button(id('purge'), 'Purge', ButtonStyle.Secondary, 'delete')),
      row(button(buildCustomId('sp', 'ch', channelId), 'Refresh', ButtonStyle.Secondary, 'refresh'), button(buildCustomId('sp', 'nav', 'channels'), 'Back', ButtonStyle.Secondary, 'back'), home()),
    ],
  };
}

export async function casesView(s: Services, guildId: string, page: number, type: CaseType | 'all'): Promise<View> {
  const p = await s.cases.recent(guildId, page, type === 'all' ? undefined : type);
  const embed = titled('primary', 'history', 'Recent cases', p.items.length ? p.items.map(caseLine).join('\n') : 'No cases found.').setFooter({ text: `ZiuuX • ${p.total} case(s) • filter: ${type === 'all' ? 'all' : CASE_LABEL[type]} • page ${p.page + 1}/${p.pages}` });
  return {
    embeds: [embed],
    components: [
      row(stringSelect(buildCustomId('sp', 'casefilter'), 'Filter by type…', [{ label: 'All cases', value: 'all', default: type === 'all' }, ...CASE_TYPES.map((t) => ({ label: CASE_LABEL[t], value: t, default: t === type }))])),
      row(...pageButtons(p.page, p.pages, (n) => buildCustomId('sp', 'cases', n, type))),
      row(home()),
    ],
  };
}

export async function settingsView(s: Services, guild: Guild): Promise<View> {
  const roles = await s.staffPanel.getStaffRoleIds(guild.id);
  const embed = titled('primary', 'settings', 'Panel settings', 'Staff roles can **open** the staff panel. They never grant any moderation permission: every action still needs the matching Discord permission and role hierarchy. Members with **Timeout Members** can always open it.').addFields(
    field('Staff roles', roles.length ? roles.map((r) => `<@&${r}>`).join(' ') : 'None configured'),
  );
  return { embeds: [embed], components: [row(roleSelect(buildCustomId('sp', 'roles'), 'Staff roles (up to 10)', roles, guild, LIMITS.staffRolesMax)), row(home())] };
}

