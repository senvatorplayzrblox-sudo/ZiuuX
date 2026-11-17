import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { titled, field } from '../../ui/embeds/base.js';
import { tsBoth } from '../../utils/time.js';
import { truncate } from '../../utils/text.js';

export const roleinfo: Command = {
  key: 'roleinfo',
  data: new SlashCommandBuilder().setName('roleinfo').setDescription('Show information about a role').setContexts(InteractionContextType.Guild).addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
  access: 'public', guildOnly: true, defer: 'none',
  async execute({ interaction }) {
    const role = interaction.options.getRole('role', true);
    const r = interaction.guild?.roles.cache.get(role.id);
    const perms = r ? r.permissions.toArray() : [];
    const embed = titled('info', 'role', role.name).addFields(
      field('Role', `<@&${role.id}>\n\`${role.id}\``, true),
      field('Color', r?.hexColor ?? 'n/a', true),
      field('Position', String(r?.position ?? 'n/a'), true),
      field('Members', r ? `${r.members.size} (cached)` : 'n/a', true),
      field('Hoisted', r?.hoist ? 'Yes' : 'No', true),
      field('Mentionable', r?.mentionable ? 'Yes' : 'No', true),
      field('Managed (bot/integration)', r?.managed ? 'Yes' : 'No', true),
    );
    if (r) embed.addFields(field('Created', tsBoth(r.createdAt)));
    embed.addFields(field(`Permissions (${perms.length})`, perms.length ? truncate(perms.includes('Administrator') ? 'Administrator (all permissions)' : perms.join(', '), 1000) : 'None'));
    if (r && r.color) embed.setColor(r.color);
    await interaction.reply({ embeds: [embed] });
  },
};
