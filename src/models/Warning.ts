import { Schema, model, models } from "mongoose";

const warningSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Warning = models.Warning || model("Warning", warningSchema);
