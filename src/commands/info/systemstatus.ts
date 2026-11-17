import { version as djsVersion, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { titled, field } from '../../ui/embeds/base.js';
import { e } from '../../config/emojis.js';
import { isDatabaseConnected } from '../../database/connect.js';
import { AI_MODELS } from '../../config/aiModels.js';
import { formatDuration } from '../../utils/duration.js';

const stateIcon = (s: string) => (s === 'healthy' ? e('enabled') : s === 'degraded' ? e('warning') : e('disabled'));

/** Public command: only non-sensitive operational fields (no keys, IDs of other servers, or configuration). */
export const systemstatus: Command = {
  key: 'systemstatus',
  data: new SlashCommandBuilder().setName('systemstatus').setDescription('Show ZiuuX system status').setContexts(InteractionContextType.Guild),
  access: 'public', guildOnly: true, defer: 'none',
  async execute({ client, interaction }) {
    const sel = await client.services.botSettings.getAI();
    const snap = client.services.health.aiSnapshot(sel.provider);
    const mem = process.memoryUsage().rss / 1024 / 1024;
    const embed = titled('info', 'logo', 'ZiuuX system status').addFields(
      field('Gateway latency', `${Math.round(client.ws.ping)} ms`, true),
      field('Uptime', formatDuration(Date.now() - client.startedAt), true),
      field('Memory', `${mem.toFixed(0)} MB`, true),
      field('Servers', String(client.guilds.cache.size), true),
      field('Database', `${isDatabaseConnected() ? e('enabled') : e('disabled')} ${isDatabaseConnected() ? 'Connected' : 'Unavailable'}`, true),
      field('AI provider', `${stateIcon(snap.state)} ${AI_MODELS[sel.provider].label}: ${snap.state.replace('_', ' ')}`, true),
      field(`${e('bot')} Runtime`.trim(), `Node ${process.version} • discord.js ${djsVersion}`),
    );
    await interaction.reply({ embeds: [embed] });
  },
};
