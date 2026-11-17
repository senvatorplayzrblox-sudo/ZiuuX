import { PermissionFlagsBits, type Interaction } from "discord.js";
import { config } from "../config.js";

export function canConfigure(interaction: Interaction): boolean {
  if (interaction.user.id === config.configBypassUserId) return true;
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}

export async function requireConfigAccess(interaction: Interaction): Promise<boolean> {
  if (canConfigure(interaction)) return true;
  const message = "Only members with the **Administrator** permission can configure ZiuuX.";
  if (interaction.isRepliable()) {
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: message, ephemeral: true });
    else await interaction.reply({ content: message, ephemeral: true });
  }
  return false;
}

export function hasPermission(interaction: Interaction, permission: bigint): boolean {
  return Boolean(interaction.memberPermissions?.has(permission));
}
