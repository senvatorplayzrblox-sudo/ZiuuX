import { Schema, model, models } from "mongoose";

const logRouteSchema = new Schema({
  event: { type: String, required: true },
  channelId: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedBy: String,
  updatedAt: Date,
  lastStatus: { type: String, default: "Not sent yet" },
  lastSuccessAt: Date
}, { _id: false });

const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  aiModEnabled: { type: Boolean, default: false },
  bannedWords: { type: [String], default: [] },
  exemptRoleIds: { type: [String], default: [] },
  exemptChannelIds: { type: [String], default: [] },
  commandConfig: { type: Schema.Types.Mixed, default: {} },
  logRoutes: { type: [logRouteSchema], default: [] }
}, { timestamps: true });

export const GuildConfig = models.GuildConfig || model("GuildConfig", guildConfigSchema);
