import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  PermissionFlagsBits, CommandInteraction, StringSelectMenuBuilder,
  TextChannel, User
} from "discord.js";
import { GuildConfig } from "../models/GuildConfig.js";
import { Warning } from "../models/Warning.js";
import { requireConfigAccess, hasPermission } from "../utils/access.js";
import { panel, success, error } from "../utils/embeds.js";

const LOG_EVENTS = [
  "member_join", "member_leave", "member_ban", "member_unban", "message_delete",
  "message_edit", "message_bulk_delete", "member_update", "role_update",
  "channel_update", "channel_create", "channel_delete", "voice_update",
  "moderation", "command_use", "invite_create", "thread_update"
];

async function getConfig(guildId: string) {
  return GuildConfig.findOneAndUpdate({ guildId }, { $setOnInsert: { guildId } }, { upsert: true, new: true });
}

function isTextChannel(channel: unknown): channel is TextChannel {
  return Boolean(channel && typeof channel === "object" && "send" in channel && "permissionOverwrites" in channel);
}

export async function handleCommand(i: SlashCommandInteraction): Promise<void> {
  if (!i.guild) {
    await i.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const guildId = i.guild.id;
  const name = i.commandName;

  if (["aimod", "cmdconfig", "setlogs", "listlogs"].includes(name)) {
    if (!(await requireConfigAccess(i))) return;
  }

  if (name === "aimod") {
    const cfg = await getConfig(guildId);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("aimod:toggle").setLabel(cfg.aiModEnabled ? "Turn OFF" : "Turn ON").setStyle(cfg.aiModEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId("aimod:words").setLabel("Banned words").setStyle(ButtonStyle.Secondary)
    );
    await i.reply({
      embeds: [panel("🛡️ ZiuuX Moderation", `Status: **${cfg.aiModEnabled ? "ON" : "OFF"}**\nBanned words: **${cfg.bannedWords.length}**\n\nAI provider: **Not connected**. Keyword rules can be managed below; AI classification is not active.`)],
      components: [row], ephemeral: true
    });
    return;
  }

  if (name === "cmdconfig") {
    const cfg = await getConfig(guildId);
    const configured = Object.keys(cfg.commandConfig ?? {}).length;
    await i.reply({
      embeds: [panel("⚙️ Command Configuration", `Saved command overrides: **${configured}**\n\nUse the menu to enable or disable ZiuuX commands for this server. This does not control commands belonging to other bots.`)],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("cmdconfig:select").setPlaceholder("Choose a command").addOptions(
          ["aimod","cmdconfig","setlogs","listlogs","warn","warnings","removewarn","clearwarnings","purge","lock","unlock","slowmode","userinfo","serverinfo","systemstatus"]
            .map(v => ({ label: `/${v}`, value: v }))
        )
      )], ephemeral: true
    });
    return;
  }

  if (name === "setlogs") {
    await i.reply({
      embeds: [panel("🧾 Set Log Destination", "Choose the event type. You will then select a text channel.")],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("logs:event").setPlaceholder("Choose event type")
          .addOptions(LOG_EVENTS.map(e => ({ label: e.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()), value: e })))
      )], ephemeral: true
    });
    return;
  }

  if (name === "listlogs") {
    const cfg = await getConfig(guildId);
    const lines = cfg.logRoutes.length
      ? cfg.logRoutes.map((r: any) => `• **${r.event}** → <#${r.channelId}> — ${r.enabled ? "Enabled" : "Disabled"} — ${r.lastStatus}`).join("\n")
      : "No log routes configured yet.";
    await i.reply({ embeds: [panel("📋 Configured Logs", lines)], ephemeral: true });
    return;
  }

  if (name === "warn") {
    if (!hasPermission(i, PermissionFlagsBits.ModerateMembers)) {
      await i.reply({ embeds: [error("You need the Moderate Members permission.")], ephemeral: true }); return;
    }
    const target = i.options.getUser("member", true);
    const reason = i.options.getString("reason", true);
    if (target.bot || target.id === i.user.id) {
      await i.reply({ embeds: [error("You cannot warn that account.")], ephemeral: true }); return;
    }
    const record = await Warning.create({ guildId, userId: target.id, moderatorId: i.user.id, reason });
    await i.reply({ embeds: [success(`Warned ${target.tag}. Warning ID: \`${record.id}\``)], ephemeral: true });
    try { await target.send(`You received a warning in **${i.guild.name}**.\nReason: ${reason}`); } catch { /* DMs may be closed */ }
    return;
  }

  if (name === "warnings") {
    if (!hasPermission(i, PermissionFlagsBits.ModerateMembers)) {
      await i.reply({ embeds: [error("You need the Moderate Members permission.")], ephemeral: true }); return;
    }
    const target = i.options.getUser("member", true);
    const rows = await Warning.find({ guildId, userId: target.id }).sort({ createdAt: -1 }).limit(15).lean();
    const desc = rows.length ? rows.map((w: any) => `**${w._id}** — ${w.reason}\nBy <@${w.moderatorId}> • <t:${Math.floor(new Date(w.createdAt).getTime()/1000)}:R>`).join("\n\n") : "No warnings found.";
    await i.reply({ embeds: [panel(`Warnings: ${target.tag}`, desc)], ephemeral: true }); return;
  }

  if (name === "removewarn") {
    if (!hasPermission(i, PermissionFlagsBits.ModerateMembers)) {
      await i.reply({ embeds: [error("You need the Moderate Members permission.")], ephemeral: true }); return;
    }
    const id = i.options.getString("warning_id", true);
    const result = await Warning.deleteOne({ _id: id, guildId });
    await i.reply({ embeds: [result.deletedCount ? success("Warning removed.") : error("Warning ID not found in this server.")], ephemeral: true }); return;
  }

  if (name === "clearwarnings") {
    if (!hasPermission(i, PermissionFlagsBits.ModerateMembers)) {
      await i.reply({ embeds: [error("You need the Moderate Members permission.")], ephemeral: true }); return;
    }
    const target = i.options.getUser("member", true);
    const result = await Warning.deleteMany({ guildId, userId: target.id });
    await i.reply({ embeds: [success(`Removed ${result.deletedCount} warning(s) for ${target.tag}.`)], ephemeral: true }); return;
  }

  if (name === "purge") {
    if (!hasPermission(i, PermissionFlagsBits.ManageMessages)) {
      await i.reply({ embeds: [error("You need Manage Messages.")], ephemeral: true }); return;
    }
    const amount = i.options.getInteger("amount", true);
    const channel = i.channel;
    if (!isTextChannel(channel)) { await i.reply({ embeds: [error("Use this in a text channel.")], ephemeral: true }); return; }
    const deleted = await channel.bulkDelete(amount, true);
    await i.reply({ embeds: [success(`Deleted ${deleted.size} recent messages. Messages older than 14 days cannot be bulk-deleted.`)], ephemeral: true }); return;
  }

  if (name === "lock" || name === "unlock") {
    if (!hasPermission(i, PermissionFlagsBits.ManageChannels)) {
      await i.reply({ embeds: [error("You need Manage Channels.")], ephemeral: true }); return;
    }
    const channel = i.channel;
    if (!isTextChannel(channel)) { await i.reply({ embeds: [error("Use this in a text channel.")], ephemeral: true }); return; }
    await channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: name === "unlock" ? null : false });
    await i.reply({ embeds: [success(`Channel ${name === "lock" ? "locked" : "unlocked"}.`)] }); return;
  }

  if (name === "slowmode") {
    if (!hasPermission(i, PermissionFlagsBits.ManageChannels)) {
      await i.reply({ embeds: [error("You need Manage Channels.")], ephemeral: true }); return;
    }
    const channel = i.channel;
    if (!isTextChannel(channel)) { await i.reply({ embeds: [error("Use this in a text channel.")], ephemeral: true }); return; }
    const seconds = i.options.getInteger("seconds", true);
    await channel.setRateLimitPerUser(seconds);
    await i.reply({ embeds: [success(`Slowmode set to ${seconds} seconds.`)] }); return;
  }

  if (name === "userinfo") {
    const target = i.options.getUser("member") ?? i.user;
    const member = await i.guild.members.fetch(target.id).catch(() => null);
    const embed = panel(`👤 ${target.tag}`, `User ID: \`${target.id}\`\nCreated: <t:${Math.floor(target.createdTimestamp/1000)}:F>\nJoined: ${member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp/1000)}:F>` : "Unknown"}\nBot: ${target.bot ? "Yes" : "No"}`);
    if (target.displayAvatarURL()) embed.setThumbnail(target.displayAvatarURL());
    await i.reply({ embeds: [embed], ephemeral: true }); return;
  }

  if (name === "serverinfo") {
    await i.reply({ embeds: [panel(`🏠 ${i.guild.name}`, `Server ID: \`${guildId}\`\nMembers: **${i.guild.memberCount}**\nCreated: <t:${Math.floor(i.guild.createdTimestamp/1000)}:F>\nOwner: <@${i.guild.ownerId}>`)], ephemeral: true }); return;
  }

  if (name === "systemstatus") {
    await i.reply({ embeds: [panel("📊 ZiuuX System Status", `Bot: **Online**\nDatabase: **Connected**\nGuild: **${i.guild.name}**\nLatency: **${i.client.ws.ping} ms**`)], ephemeral: true }); return;
  }
}

export async function handleComponent(i: any): Promise<void> {
  if (!i.guild) return;
  const [scope, action] = String(i.customId).split(":");
  if (["aimod", "cmdconfig", "logs"].includes(scope) && !(await requireConfigAccess(i))) return;
  const cfg = await getConfig(i.guild.id);

  if (scope === "aimod" && action === "toggle") {
    cfg.aiModEnabled = !cfg.aiModEnabled;
    await cfg.save();
    await i.update({ embeds: [panel("🛡️ ZiuuX Moderation", `Moderation is now **${cfg.aiModEnabled ? "ON" : "OFF"}**. Existing settings were preserved.`)], components: [] });
    return;
  }
  if (scope === "aimod" && action === "words") {
    await i.reply({ content: `Current banned words (${cfg.bannedWords.length}):\n${cfg.bannedWords.slice(0, 50).map((w: string) => `• ${w}`).join("\n") || "None"}\n\nUse /aimod dashboard controls for future word management.`, ephemeral: true });
    return;
  }
  if (scope === "cmdconfig" && action === "select") {
    const command = i.values[0] as string;
    const currentlyEnabled = cfg.commandConfig?.[command] !== false;
    cfg.commandConfig = { ...(cfg.commandConfig ?? {}), [command]: !currentlyEnabled };
    await cfg.save();
    await i.reply({ content: `/${command} is now **${!currentlyEnabled ? "enabled" : "disabled"}** in ZiuuX command configuration.`, ephemeral: true });
    return;
  }
  if (scope === "logs" && action === "event") {
    const event = i.values[0] as string;
    const channels = i.guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildText).first(25);
    if (!channels.length) { await i.reply({ content: "No text channels are available.", ephemeral: true }); return; }
    const menu = new StringSelectMenuBuilder().setCustomId(`logs:channel:${event}`).setPlaceholder("Choose a log channel")
      .addOptions(channels.map((c: any) => ({ label: c.name.slice(0, 100), value: c.id })));
    await i.reply({ content: `Select the destination for **${event}**:`, components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ephemeral: true });
    return;
  }
  if (scope === "logs" && action === "channel") {
    const event = String(i.customId).split(":")[2] ?? "";
    const channelId = i.values[0] as string;
    const route = cfg.logRoutes.find((r: any) => r.event === event);
    if (route) {
      route.channelId = channelId; route.enabled = true; route.updatedBy = i.user.id; route.updatedAt = new Date();
    } else {
      cfg.logRoutes.push({ event, channelId, enabled: true, createdBy: i.user.id, createdAt: new Date(), lastStatus: "Not sent yet" } as any);
    }
    await cfg.save();
    await i.update({ content: `Log route **${event}** now sends to <#${channelId}>.`, components: [] });
  }
}
