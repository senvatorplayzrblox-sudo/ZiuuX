import { Events } from 'discord.js';
import { defineEvent } from '../../types/event.js';
import { routeInteraction } from '../../core/pipeline/interactionPipeline.js';

export default defineEvent({
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    await routeInteraction(client, interaction);
  },
});
