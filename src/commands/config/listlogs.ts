import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { resolveGuildActor } from '../../core/access.js';
import { notify } from '../../core/respond.js';
import { LOG_CATEGORY_META } from '../../config/logCategories.js';
import { e } from '../../config/emojis.js';
import { titled } from '../../ui/embeds/base.js';
import type { LogStatus } from '../../services/LoggingService.js';

const STATUS: Record<LogStatus, string> = {
  active: 'active', disabled: 'disabled', not_configured: 'not configured', channel_missing: 'channel missing', missing_permissions: 'missing permissions',
};
const ICON = (s: LogStatus) => (s === 'active' ? e('enabled') : s === 'disabled' || s === 'not_configured' ? e('disabled') : e('warning'));

export const listlogs: Command = {
  key: 'listlogs',
  data: new SlashCommandBuilder().setName('listlogs').setDescription('Show configured logging channels and their status').setContexts(InteractionContextType.Guild),
  access: 'config', guildOnly: true, defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild } = await resolveGuildActor(interaction);
    const rows = await client.services.logging.status(guild);
    const lines = rows.map((r) => `${ICON(r.status)} ${e(LOG_CATEGORY_META[r.category].emoji)} **${LOG_CATEGORY_META[r.category].label}** → ${r.channelId ? `<#${r.channelId}>` : '—'} • ${STATUS[r.status]}`);
    const embed = titled('primary', 'logs', 'Logging configuration', lines.join('\n')).setFooter({ text: 'ZiuuX • use /setlogs to change these' });
    await notify(interaction, embed);
  },
};
