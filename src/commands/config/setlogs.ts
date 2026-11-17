import { InteractionContextType, SlashCommandBuilder, ChannelType } from 'discord.js';
import type { Command } from '../../types/command.js';
import { BotError } from '../../core/errors/BotError.js';
import { resolveGuildActor } from '../../core/access.js';
import { notify } from '../../core/respond.js';
import { LOG_CATEGORIES, LOG_CATEGORY_META, isLogCategory, type LogCategory } from '../../config/logCategories.js';
import { successEmbed } from '../../ui/embeds/base.js';

const choices = (withAll: boolean) => [...(withAll ? [{ name: 'All categories', value: 'all' }] : []), ...LOG_CATEGORIES.map((c) => ({ name: LOG_CATEGORY_META[c].label, value: c }))];

function categoriesOf(v: string): readonly LogCategory[] {
  if (v === 'all') return LOG_CATEGORIES;
  if (!isLogCategory(v)) throw new BotError('invalid_input', 'Unknown log category.');
  return [v];
}

export const setlogs: Command = {
  key: 'setlogs',
  data: new SlashCommandBuilder()
    .setName('setlogs').setDescription('Configure logging channels').setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('set').setDescription('Send a log category to a channel')
      .addStringOption((o) => o.setName('category').setDescription('Log category').addChoices(...choices(true)).setRequired(true))
      .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)))
    .addSubcommand((s) => s.setName('enable').setDescription('Re-enable a configured category')
      .addStringOption((o) => o.setName('category').setDescription('Log category').addChoices(...choices(false)).setRequired(true)))
    .addSubcommand((s) => s.setName('disable').setDescription('Pause a category without forgetting its channel')
      .addStringOption((o) => o.setName('category').setDescription('Log category').addChoices(...choices(false)).setRequired(true)))
    .addSubcommand((s) => s.setName('clear').setDescription('Remove the channel for a category')
      .addStringOption((o) => o.setName('category').setDescription('Log category').addChoices(...choices(true)).setRequired(true))),
  access: 'config', guildOnly: true, defer: 'ephemeral',
  async execute({ client, interaction }) {
    const { guild } = await resolveGuildActor(interaction);
    const log = client.services.logging;
    const sub = interaction.options.getSubcommand();
    const cats = categoriesOf(interaction.options.getString('category', true));
    const names = cats.map((c) => LOG_CATEGORY_META[c].label).join(', ');
    if (sub === 'set') {
      const picked = interaction.options.getChannel('channel', true);
      const channel = guild.channels.cache.get(picked.id) ?? (await guild.channels.fetch(picked.id));
      if (!channel) throw new BotError('not_found', 'That channel could not be found.');
      await log.setChannel(guild, cats, channel);
      await notify(interaction, successEmbed(`**${names}** will now be logged in <#${channel.id}>.`));
    } else if (sub === 'enable') {
      await log.setEnabled(guild.id, cats[0]!, true);
      await notify(interaction, successEmbed(`Logging enabled for **${names}**.`));
    } else if (sub === 'disable') {
      await log.setEnabled(guild.id, cats[0]!, false);
      await notify(interaction, successEmbed(`Logging paused for **${names}**.`));
    } else {
      for (const c of cats) await log.clear(guild.id, c);
      await notify(interaction, successEmbed(`Cleared the log channel for **${names}**.`));
    }
  },
};
