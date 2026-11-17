import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { resolveGuildActor } from '../../core/access.js';
import { showView } from '../../core/respond.js';
import { homeView } from '../../ui/panels/staffpanel/views.js';

export const staffpanel: Command = {
  key: 'staffpanel',
  data: new SlashCommandBuilder().setName('staffpanel').setDescription('Open the interactive staff moderation panel').setContexts(InteractionContextType.Guild),
  access: 'staff', guildOnly: true, defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild } = await resolveGuildActor(interaction);
    await showView(interaction, await homeView(client.services, guild));
  },
};
