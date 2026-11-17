import {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType
} from "discord.js";

export const commands = [
  new SlashCommandBuilder().setName("aimod").setDescription("Open ZiuuX moderation settings"),
  new SlashCommandBuilder().setName("cmdconfig").setDescription("Configure ZiuuX command settings"),
  new SlashCommandBuilder().setName("setlogs").setDescription("Configure a server log destination"),
  new SlashCommandBuilder().setName("listlogs").setDescription("View and manage log destinations"),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a member")
    .addUserOption(o => o.setName("member").setDescription("Member to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName("warnings").setDescription("View a member's warnings")
    .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true)),
  new SlashCommandBuilder().setName("removewarn").setDescription("Remove a warning")
    .addStringOption(o => o.setName("warning_id").setDescription("Warning record ID").setRequired(true)),
  new SlashCommandBuilder().setName("clearwarnings").setDescription("Clear a member's warnings")
    .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true)),
  new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName("lock").setDescription("Lock this text channel"),
  new SlashCommandBuilder().setName("unlock").setDescription("Unlock this text channel"),
  new SlashCommandBuilder().setName("slowmode").setDescription("Set channel slowmode")
    .addIntegerOption(o => o.setName("seconds").setDescription("0-21600 seconds").setRequired(true).setMinValue(0).setMaxValue(21600)),
  new SlashCommandBuilder().setName("userinfo").setDescription("Show member information")
    .addUserOption(o => o.setName("member").setDescription("Member").setRequired(false)),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information"),
  new SlashCommandBuilder().setName("systemstatus").setDescription("Show ZiuuX system status")
].map(c => c.toJSON());
