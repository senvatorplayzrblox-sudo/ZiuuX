import { ChannelType, GuildMember, type Guild, type User } from 'discord.js';
import { BotError } from '../../core/errors/BotError.js';
import { assertCommandAllowed, assertConfigAccess, assertStaffAccess, resolveGuildActor, type GuildActor } from '../../core/access.js';
import { deferEphemeral, deferPanel, editView, notify } from '../../core/respond.js';
import type { ComponentCtx, ModuleHandler } from '../../core/registry/InteractionRegistry.js';
import type { CommandKey } from '../../config/commandKeys.js';
import { LIMITS } from '../../config/constants.js';
import { buildCustomId } from '../customId.js';
import { isCaseType, type CaseType } from '../../types/moderation.js';
import { modal } from '../../ui/components/builders.js';
import { cardView, casesView, channelCardView, channelsView, confirmClearView, historyView, homeView, membersView, removeWarnView, settingsView } from '../../ui/panels/staffpanel/views.js';
import { successEmbed, titled } from '../../ui/embeds/base.js';
import { CASE_EMOJI, CASE_LABEL } from '../../ui/embeds/case.js';
import { cleanReason } from '../../utils/text.js';
import { formatDuration, parseDuration } from '../../utils/duration.js';
import { parseSnowflake, isSnowflake } from '../../utils/snowflake.js';
import type { CaseDoc } from '../../types/moderation.js';
import type { ModResult } from '../../services/ModerationService.js';

const expired = () => new BotError('not_found', 'This panel has expired. Please run /staffpanel again.');
const snow = (v: string | undefined): string => {
  if (!isSnowflake(v)) throw expired();
  return v;
};

/** Which logical command each panel action falls under, so /cmdconfig cannot be bypassed through the panel. */
const ACTION_COMMAND: Record<string, CommandKey> = {
  warn: 'warn', timeout: 'timeout', kick: 'kick', ban: 'ban', lock: 'lock', unlock: 'unlock', slowmode: 'slowmode', purge: 'purge',
};

async function loadTarget(a: GuildActor, id: string, client: ComponentCtx['client']): Promise<{ user: User; member: GuildMember | null }> {
  const member = await a.guild.members.fetch(id).catch(() => null);
  const user = member?.user ?? (await client.users.fetch(id).catch(() => null));
  if (!user) throw new BotError('not_found', 'That user could not be found.');
  return { user, member };
}

async function resolveChannel(guild: Guild, id: string) {
  const ch = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
  if (!ch) throw new BotError('not_found', 'That channel no longer exists.');
  return ch;
}

function requireConfirm(text: string, word: string): void {
  if (text.trim().toUpperCase() !== word) throw new BotError('invalid_input', `Confirmation text did not match (expected \`${word}\`). The action was cancelled.`);
}

const resultEmbed = (c: CaseDoc, lines: string[], dm?: boolean | null) =>
  titled('success', CASE_EMOJI[c.type], `${CASE_LABEL[c.type]} • Case #${c.caseNumber}`, [...lines, ...(dm === null || dm === undefined ? [] : [dm ? 'The user was notified by DM.' : 'The user could not be notified by DM.'])].join('\n'));

export const staffpanelHandler: ModuleHandler = {
  async handle({ client, interaction, action, args }: ComponentCtx) {
    const s = client.services;
    const actor = await resolveGuildActor(interaction);
    await assertStaffAccess(s, actor); // staff gate: re-checked on EVERY interaction
    await assertCommandAllowed(s, actor, 'staffpanel', interaction);
    const { guild, member } = actor;
    const values = interaction.isAnySelectMenu() ? interaction.values : [];
    const need = (key: CommandKey) => assertCommandAllowed(s, actor, key, interaction);

    // ================= Modal submissions (the actual actions) =================
    if (interaction.isModalSubmit()) {
      if (action !== 'm') throw expired();
      const kind = args[0] ?? '';
      const id = snow(args[1]);
      const key = ACTION_COMMAND[kind];
      if (!key) throw expired();
      await need(key); // /cmdconfig re-checked at submit time too
      await deferEphemeral(interaction);
      const f = (name: string) => interaction.fields.getTextInputValue(name);
      const reason = (name = 'reason') => cleanReason(f(name));
      const base = { guild, actor: member, source: 'panel' as const };

      if (kind === 'warn' || kind === 'timeout' || kind === 'kick') {
        const target = await guild.members.fetch(id).catch(() => null);
        if (!target) throw new BotError('not_found', 'That user is no longer in this server.');
        let r: ModResult;
        let line: string;
        if (kind === 'warn') {
          r = await s.moderation.warn({ ...base, reason: reason() }, target);
          line = `Warned <@${id}>.`;
        } else if (kind === 'timeout') {
          const ms = parseDuration(f('duration'));
          if (ms === null || ms < LIMITS.timeoutMinMs || ms > LIMITS.timeoutMaxMs) throw new BotError('invalid_input', 'Invalid duration. Use units like `10m`, `2h`, `1d` (5 seconds to 28 days).');
          r = await s.moderation.timeout({ ...base, reason: reason() }, target, ms);
          line = `Timed out <@${id}> for **${formatDuration(ms)}**.`;
        } else {
          requireConfirm(f('confirm'), 'KICK');
          r = await s.moderation.kick({ ...base, reason: reason() }, target);
          line = `Kicked <@${id}>.`;
        }
        await notify(interaction, resultEmbed(r.case, [line], r.dmDelivered));
      } else if (kind === 'ban') {
        requireConfirm(f('confirm'), 'BAN');
        const rawDays = f('days').trim();
        const days = rawDays === '' ? 0 : Number(rawDays);
        if (!Number.isInteger(days) || days < 0 || days > LIMITS.banDeleteDaysMax) throw new BotError('invalid_input', 'Days of messages to delete must be a whole number from 0 to 7.');
        const { user } = await loadTarget(actor, id, client);
        const r = await s.moderation.ban({ ...base, reason: reason() }, user, days);
        await notify(interaction, resultEmbed(r.case, [`Banned <@${id}> permanently.`], r.dmDelivered));
      } else if (kind === 'slowmode') {
        const secs = Number(f('seconds').trim());
        if (!Number.isInteger(secs)) throw new BotError('invalid_input', 'Seconds must be a whole number from 0 to 21600.');
        const ch = await resolveChannel(guild, id);
        if (ch.type !== ChannelType.GuildText) throw new BotError('invalid_input', 'Slowmode can only be set on regular text channels.');
        const r = await s.moderation.slowmode({ ...base, reason: reason() }, ch as never, secs);
        await notify(interaction, resultEmbed(r.case, [secs === 0 ? `Disabled slowmode in <#${id}>.` : `Set slowmode in <#${id}> to **${secs}s**.`]));
      } else if (kind === 'purge') {
        const amount = Number(f('amount').trim());
        const rawUser = f('user').trim();
        const userId = rawUser ? parseSnowflake(rawUser) : null;
        if (rawUser && !userId) throw new BotError('invalid_input', 'The user filter must be a user ID or mention.');
        const ch = await resolveChannel(guild, id);
        if (!ch.isTextBased()) throw new BotError('invalid_input', 'That is not a text channel.');
        const r = await s.moderation.purge({ ...base, reason: reason() }, ch, amount, userId);
        await notify(interaction, resultEmbed(r.case, [`Deleted **${r.deleted}** message(s) in <#${id}>${userId ? ` from <@${userId}>` : ''}.`]));
      } else throw expired();
      return;
    }

    // ================= Actions that open a modal (must not be deferred) =================
    if (interaction.isButton() && action === 'act') {
      const kind = args[0] ?? '';
      const id = snow(args[1]);
      const key = ACTION_COMMAND[kind];
      if (!key) throw expired();
      await need(key);
      const reasonField = { id: 'reason', label: 'Reason', style: 'paragraph' as const, required: false, max: LIMITS.reasonMax };
      const mid = buildCustomId('sp', 'm', kind, id);
      if (kind === 'warn') await interaction.showModal(modal(mid, 'Warn member', [{ ...reasonField, required: true }]));
      else if (kind === 'timeout') await interaction.showModal(modal(mid, 'Timeout member', [{ id: 'duration', label: 'Duration (e.g. 10m, 2h, 1d)', required: true, max: 20, placeholder: '10m' }, reasonField]));
      else if (kind === 'kick') await interaction.showModal(modal(mid, 'Kick member', [reasonField, { id: 'confirm', label: 'Type KICK to confirm', required: true, max: 4, min: 4 }]));
      else if (kind === 'ban') await interaction.showModal(modal(mid, 'Ban member (permanent)', [reasonField, { id: 'days', label: 'Delete message history (days, 0-7)', required: false, max: 1, value: '0' }, { id: 'confirm', label: 'Type BAN to confirm', required: true, max: 3, min: 3 }]));
      else throw expired();
      return;
    }
    if (interaction.isButton() && action === 'chact' && (args[0] === 'slowmode' || args[0] === 'purge')) {
      const kind = args[0];
      const id = snow(args[1]);
      await need(kind);
      const mid = buildCustomId('sp', 'm', kind, id);
      if (kind === 'slowmode') await interaction.showModal(modal(mid, 'Set slowmode', [{ id: 'seconds', label: 'Seconds between messages (0 = off, max 21600)', required: true, max: 5, value: '0' }, { id: 'reason', label: 'Reason', required: false, max: LIMITS.reasonMax }]));
      else await interaction.showModal(modal(mid, 'Purge messages', [{ id: 'amount', label: 'Number of messages (1-100)', required: true, max: 3 }, { id: 'user', label: 'Only from this user ID (optional)', required: false, max: 40 }, { id: 'reason', label: 'Reason', required: false, max: LIMITS.reasonMax }]));
      return;
    }

    // ================= Navigation / in-panel actions =================
    await deferPanel(interaction);
    switch (action) {
      case 'nav': {
        const to = args[0];
        if (to === 'home') await editView(interaction, await homeView(s, guild));
        else if (to === 'members') await editView(interaction, membersView());
        else if (to === 'channels') await editView(interaction, channelsView(interaction.channelId ?? guild.id, guild));
        else if (to === 'cases') await editView(interaction, await casesView(s, guild.id, 0, 'all'));
        else if (to === 'settings') {
          await assertConfigAccess(s, actor, 'staffpanel');
          await editView(interaction, await settingsView(s, guild));
        } else throw expired();
        return;
      }
      case 'pickuser':
      case 'card': {
        const { user, member: target } = await loadTarget(actor, action === 'pickuser' ? snow(values[0]) : snow(args[0]), client);
        await editView(interaction, await cardView(s, guild, member, user, target));
        return;
      }
      case 'hist': {
        await need('warnings');
        const { user } = await loadTarget(actor, snow(args[0]), client);
        await editView(interaction, await historyView(s, guild, user));
        return;
      }
      case 'rmpick': {
        await need('removewarn');
        const { user } = await loadTarget(actor, snow(args[0]), client);
        await editView(interaction, await removeWarnView(s, guild, user));
        return;
      }
      case 'rmwarn': {
        await need('removewarn');
        const uid = snow(args[0]);
        const caseNumber = Number(values[0]);
        const owned = (await s.warnings.list(guild.id, uid, { activeOnly: true, limit: 25 })).some((w) => w.caseNumber === caseNumber);
        if (!owned) throw new BotError('not_found', 'That warning is no longer active.');
        const r = await s.moderation.removeWarning({ guild, actor: member, source: 'panel', reason: 'Removed via staff panel' }, caseNumber);
        await notify(interaction, resultEmbed(r.case, [`Removed warning #${caseNumber} from <@${uid}>.`]));
        const { user, member: target } = await loadTarget(actor, uid, client);
        await editView(interaction, await cardView(s, guild, member, user, target));
        return;
      }
      case 'clr': {
        await need('clearwarnings');
        const { user } = await loadTarget(actor, snow(args[0]), client);
        await editView(interaction, confirmClearView(user));
        return;
      }
      case 'clrok': {
        await need('clearwarnings');
        const { user, member: target } = await loadTarget(actor, snow(args[0]), client);
        const r = await s.moderation.clearWarnings({ guild, actor: member, source: 'panel', reason: 'Cleared via staff panel' }, user);
        await notify(interaction, resultEmbed(r.case, [`Cleared **${r.cleared}** warning(s) for <@${user.id}>.`]));
        await editView(interaction, await cardView(s, guild, member, user, target));
        return;
      }
      case 'pickch':
      case 'ch':
        await editView(interaction, await channelCardView(s, guild, action === 'pickch' ? snow(values[0]) : snow(args[0])));
        return;
      case 'chact': {
        const kind = args[0] ?? '';
        const id = snow(args[1]);
        if (kind !== 'lock' && kind !== 'unlock') throw expired();
        await need(kind);
        const ch = await resolveChannel(guild, id);
        if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) throw new BotError('invalid_input', 'Only text and announcement channels can be locked.');
        const base = { guild, actor: member, source: 'panel' as const, reason: `${kind === 'lock' ? 'Locked' : 'Unlocked'} via staff panel` };
        const r = kind === 'lock' ? await s.moderation.lock(base, ch as never) : await s.moderation.unlock(base, ch as never);
        await notify(interaction, resultEmbed(r.case, [`${kind === 'lock' ? 'Locked' : 'Unlocked'} <#${id}>.`, ...(r.note ? [r.note] : [])]));
        await editView(interaction, await channelCardView(s, guild, id));
        return;
      }
      case 'casefilter': {
        const t = values[0];
        await editView(interaction, await casesView(s, guild.id, 0, t === 'all' ? 'all' : isCaseType(t) ? t : 'all'));
        return;
      }
      case 'cases': {
        const t = args[1];
        const type: CaseType | 'all' = isCaseType(t) ? t : 'all';
        await editView(interaction, await casesView(s, guild.id, Number(args[0]) || 0, type));
        return;
      }
      case 'roles': {
        await assertConfigAccess(s, actor, 'staffpanel');
        await s.staffPanel.setStaffRoleIds(guild.id, values);
        await notify(interaction, successEmbed('Staff roles updated.'));
        await editView(interaction, await settingsView(s, guild));
        return;
      }
      default:
        throw expired();
    }
  },
};
