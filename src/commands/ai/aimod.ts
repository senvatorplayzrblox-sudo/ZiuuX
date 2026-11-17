import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { resolveGuildActor } from '../../core/access.js';
import { showView } from '../../core/respond.js';
import { renderAIView } from '../../ui/panels/aimod/views.js';

export const aimod: Command = {
  key: 'aimod',
  data: new SlashCommandBuilder().setName('aimod').setDescription('Open the AI moderation dashboard').setContexts(InteractionContextType.Guild),
  access: 'config', guildOnly: true, defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild } = await resolveGuildActor(interaction);
    await showView(interaction, await renderAIView(client.services, guild, 'overview'));
  },
};
