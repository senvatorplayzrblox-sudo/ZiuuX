import { Client, GatewayIntentBits, Events, Partials } from "discord.js";
import mongoose from "mongoose";
import { GuildConfig } from "./models/GuildConfig.js";
import { Warning } from "./models/Warning.js";
import { config } from "./config.js";
import { handleCommand, handleComponent } from "./commands/handlers.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

async function main(): Promise<void> {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log("MongoDB connected.");
  client.once(Events.ClientReady, ready => {
    console.log(`ZiuuX ready as ${ready.user.tag}`);
  });

  client.on(Events.MessageCreate, async message => {
    if (!message.guild || message.author.bot) return;
    try {
      const cfg = await GuildConfig.findOne({ guildId: message.guild.id });
      if (!cfg?.aiModEnabled) return;
      if (cfg.exemptChannelIds.includes(message.channelId) ||
          message.member?.roles.cache.some(role => cfg.exemptRoleIds.includes(role.id))) return;
      const normalize = (value: string) => value.toLowerCase().normalize("NFKC").replace(/[\p{P}\p{S}\s_]+/gu, "");
      const content = normalize(message.content);
      const matched = cfg.bannedWords.find((word: string) => {
        const normalizedWord = normalize(word);
        return normalizedWord.length > 0 && content.includes(normalizedWord);
      });
      if (!matched) return;
      await message.delete().catch(() => undefined);
      const count = await Warning.countDocuments({ guildId: message.guild.id, userId: message.author.id });
      const reason = `Automatic moderation: banned word rule (${matched})`;
      await Warning.create({ guildId: message.guild.id, userId: message.author.id, moderatorId: client.user?.id ?? "ziuux", reason });
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (count >= 2 && member?.moderatable) {
        await member.timeout(10 * 60 * 1000, "Repeated automatic moderation violations").catch(() => undefined);
      }
      const notice = await message.channel.send({ content: `<@${message.author.id}> your message was removed because it matched a server moderation rule.` }).catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => undefined), 8000);
    } catch (err) {
      console.error("Automatic moderation error:", err);
    }
  });

  client.on(Events.InteractionCreate, async interaction => {
    try {
      if (interaction.isChatInputCommand()) await handleCommand(interaction);
      else if (interaction.isButton() || interaction.isStringSelectMenu()) await handleComponent(interaction);
    } catch (err) {
      console.error("Interaction error:", err);
      const message = "Something went wrong while processing that interaction. Check the bot logs.";
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) await interaction.followUp({ content: message, ephemeral: true }).catch(() => undefined);
        else await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
      }
    }
  });

  await client.login(config.token);
}

process.on("unhandledRejection", reason => console.error("Unhandled rejection:", reason));
process.on("uncaughtException", error => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

main().catch(error => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
