import { BotError } from '../../core/errors/BotError.js';
import { assertCommandAllowed, assertConfigAccess, resolveGuildActor } from '../../core/access.js';
import { deferPanel, editView, notify } from '../../core/respond.js';
import type { ComponentCtx, ModuleHandler } from '../../core/registry/InteractionRegistry.js';
import { isConfigurableKey } from '../../config/commandKeys.js';
import { confirmResetAllView, commandView, overviewView } from '../../ui/panels/cmdconfig/views.js';
import { successEmbed } from '../../ui/embeds/base.js';

export const cmdconfigHandler: ModuleHandler = {
  async handle({ client, interaction, action, args }: ComponentCtx) {
    const s = client.services;
    const actor = await resolveGuildActor(interaction);
    await assertConfigAccess(s, actor, 'cmdconfig'); // re-checked on EVERY interaction
    await assertCommandAllowed(s, actor, 'cmdconfig', interaction);
    if (interaction.isModalSubmit()) throw new BotError('not_found', 'This panel has expired. Please run the command again.');

    const guildId = actor.guild.id;
    const by = actor.member.id;
    const keyArg = args[0];
    const needKey = () => {
      if (!isConfigurableKey(keyArg)) throw new BotError('invalid_input', 'That command cannot be configured.');
      return keyArg;
    };
    const values = interaction.isAnySelectMenu() ? interaction.values : [];

    await deferPanel(interaction);
    switch (action) {
      case 'home':
        break;
      case 'pick': {
        const key = values[0];
        if (!isConfigurableKey(key)) throw new BotError('invalid_input', 'That command cannot be configured.');
        await editView(interaction, commandView(key, await s.commandConfig.rules(guildId), actor.guild));
        return;
      }
      case 'toggle': {
        const key = needKey();
        const cur = await s.commandConfig.get(guildId, key);
        await s.commandConfig.setEnabled(guildId, key, !cur.enabled, by);
        await editView(interaction, commandView(key, await s.commandConfig.rules(guildId), actor.guild));
        return;
      }
      case 'roles': {
        const key = needKey();
        await s.commandConfig.setRoles(guildId, key, values, by);
        await editView(interaction, commandView(key, await s.commandConfig.rules(guildId), actor.guild));
        return;
      }
      case 'chans': {
        const key = needKey();
        await s.commandConfig.setChannels(guildId, key, values, by);
        await editView(interaction, commandView(key, await s.commandConfig.rules(guildId), actor.guild));
        return;
      }
      case 'reset': {
        const key = needKey();
        await s.commandConfig.reset(guildId, key);
        await editView(interaction, commandView(key, await s.commandConfig.rules(guildId), actor.guild));
        return;
      }
      case 'resetall':
        await editView(interaction, confirmResetAllView());
        return;
      case 'resetallok':
        await s.commandConfig.resetAll(guildId);
        await notify(interaction, successEmbed('All command restrictions were reset.'));
        break;
      default:
        throw new BotError('not_found', 'This panel has expired. Please run the command again.');
    }
    await editView(interaction, overviewView(await s.commandConfig.rules(guildId)));
  },
};
