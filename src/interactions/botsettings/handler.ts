import { BotError } from '../../core/errors/BotError.js';
import { deferPanel, editView, notify } from '../../core/respond.js';
import type { ComponentCtx, ModuleHandler } from '../../core/registry/InteractionRegistry.js';
import { AI_MODELS, isProviderId } from '../../config/aiModels.js';
import { TEST_MESSAGE } from '../../ai/prompts/classification.js';
import { botSettingsView } from '../../ui/panels/botsettings/views.js';
import { errorEmbed, successEmbed } from '../../ui/embeds/base.js';

export const botsettingsHandler: ModuleHandler = {
  async handle({ client, interaction, action }: ComponentCtx) {
    const s = client.services;
    s.ownerGate.assertOwner(interaction.user.id); // owner-only, re-checked on every interaction
    if (interaction.isModalSubmit()) throw new BotError('not_found', 'This panel has expired. Please run /botsettings again.');
    const values = interaction.isAnySelectMenu() ? interaction.values : [];
    await deferPanel(interaction);
    const cur = await s.botSettings.getAI();

    switch (action) {
      case 'prov': {
        const provider = values[0];
        if (!isProviderId(provider)) throw new BotError('invalid_input', 'Unknown provider.');
        const model = AI_MODELS[provider].allowed.includes(cur.model) ? cur.model : AI_MODELS[provider].default;
        await s.botSettings.setAI(interaction.user.id, provider, model);
        await notify(interaction, successEmbed(`Provider set to **${AI_MODELS[provider].label}** (\`${model}\`).`));
        break;
      }
      case 'model': {
        const model = values[0];
        if (!model) throw new BotError('invalid_input', 'No model selected.');
        await s.botSettings.setAI(interaction.user.id, cur.provider, model);
        await notify(interaction, successEmbed(`Model set to \`${model}\`.`));
        break;
      }
      case 'test': {
        // Real request through the real provider with a fixed, harmless string.
        const r = await s.classifier.classify(cur.provider, cur.model, TEST_MESSAGE, true);
        await notify(interaction, r.ok
          ? successEmbed(`**${AI_MODELS[cur.provider].label}** responded correctly with \`${cur.model}\` in ${r.latencyMs} ms.`, 'Connection OK')
          : errorEmbed(`The request failed: **${r.reason}**${r.detail ? `\n\`${r.detail.slice(0, 300)}\`` : ''}`, 'Connection failed'));
        break;
      }
      case 'show':
        break;
      default:
        throw new BotError('not_found', 'This panel has expired. Please run /botsettings again.');
    }
    await editView(interaction, await botSettingsView(s));
  },
};
