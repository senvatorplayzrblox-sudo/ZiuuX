import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { showView } from '../../core/respond.js';
import { botSettingsView } from '../../ui/panels/botsettings/views.js';

/** Owner-only. Hidden from non-admins by default_member_permissions=0; the runtime OwnerGate check is the real authority. */
export const botsettings: Command = {
  key: 'botsettings',
  data: new SlashCommandBuilder()
    .setName('botsettings').setDescription('Owner-only: global AI provider and model settings')
    .setDefaultMemberPermissions(0)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
  access: 'owner', guildOnly: false, defer: 'ephemeral',
  async execute({ client, interaction }) {
    await showView(interaction, await botSettingsView(client.services));
  },
};
