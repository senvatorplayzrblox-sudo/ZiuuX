import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { resolveGuildActor } from '../../core/access.js';
import { showView } from '../../core/respond.js';
import { overviewView } from '../../ui/panels/cmdconfig/views.js';

export const cmdconfig: Command = {
  key: 'cmdconfig',
  data: new SlashCommandBuilder().setName('cmdconfig').setDescription('Enable, disable or restrict ZiuuX commands').setContexts(InteractionContextType.Guild),
  access: 'config', guildOnly: true, defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild } = await resolveGuildActor(interaction);
    await showView(interaction, overviewView(await client.services.commandConfig.rules(guild.id)));
  },
};
