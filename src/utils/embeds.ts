import { EmbedBuilder, Colors } from "discord.js";

export function panel(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "ZiuuX • Configuration is stored in MongoDB" })
    .setTimestamp();
}

export function success(description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Green).setDescription(`✅ ${description}`).setTimestamp();
}

export function error(description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Red).setDescription(`❌ ${description}`).setTimestamp();
}
