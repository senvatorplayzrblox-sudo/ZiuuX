import { ButtonStyle } from 'discord.js';
import { AI_MODELS, AI_PROVIDER_IDS } from '../../../config/aiModels.js';
import { buildCustomId } from '../../../interactions/customId.js';
import type { Services } from '../../../types/services.js';
import { button, row, stringSelect, type View } from '../../components/builders.js';
import { field, statusIcon, titled } from '../../embeds/base.js';
import { ts } from '../../../utils/time.js';

export async function botSettingsView(s: Services): Promise<View> {
  const sel = await s.botSettings.getAI();
  const history = await s.audit.recent('settings_change', 5);
  const embed = titled('primary', 'settings', 'ZiuuX bot settings', 'Global, owner-only settings. API keys come from environment variables and are never stored or displayed.').addFields(
    field('Active provider', `${AI_MODELS[sel.provider].label}`, true),
    field('Active model', `\`${sel.model}\``, true),
    field('Failure policy', 'Fail-open (fixed): on any AI failure no moderation action is taken.', false),
  );
  for (const id of AI_PROVIDER_IDS) {
    const snap = s.health.aiSnapshot(id);
    const configured = s.providers.isConfigured(id);
    embed.addFields(field(`${statusIcon(configured)} ${AI_MODELS[id].label}`, [
      `API key: ${configured ? 'configured' : 'not configured'}`,
      `State: ${snap.state.replace('_', ' ')} (breaker ${snap.breaker})`,
      `Calls: ${snap.successes} ok / ${snap.failures} failed`,
      snap.lastSuccessAt ? `Last success: ${ts(snap.lastSuccessAt, 'R')}` : 'Last success: never',
      snap.lastError ? `Last error: ${snap.lastError}` : '',
    ].filter(Boolean).join('\n'), true));
  }
  embed.addFields(field('Recent changes', history.length ? history.map((h) => `${ts(h.createdAt, 'R')} <@${h.userId}>: ${h.detail}`).join('\n') : 'None yet'));
  return {
    embeds: [embed],
    components: [
      row(stringSelect(buildCustomId('bs', 'prov'), 'AI provider', AI_PROVIDER_IDS.map((id) => ({ label: AI_MODELS[id].label, value: id, description: s.providers.isConfigured(id) ? 'API key configured' : 'No API key (unavailable)', default: id === sel.provider })))),
      row(stringSelect(buildCustomId('bs', 'model'), 'Model', AI_MODELS[sel.provider].allowed.map((m) => ({ label: m, value: m, default: m === sel.model })))),
      row(button(buildCustomId('bs', 'test'), 'Test connection', ButtonStyle.Primary, 'aiDetect'), button(buildCustomId('bs', 'show'), 'Refresh', ButtonStyle.Secondary, 'refresh')),
    ],
  };
}
