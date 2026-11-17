import { AIConfigModel } from '../models/index.js';

export const AIConfigRepo = {
  async get(guildId: string): Promise<Record<string, unknown> | null> {
    return AIConfigModel.findOne({ guildId }).lean<Record<string, unknown>>().exec();
  },
  /** `set` is a flat dotted-path $set (e.g. { "categories.hate.threshold": 0.8 }). */
  async patch(guildId: string, set: Record<string, unknown>): Promise<void> {
    await AIConfigModel.updateOne({ guildId }, { $set: set }, { upsert: true, setDefaultsOnInsert: false });
  },
  async deleteGuildData(guildId: string): Promise<void> {
    await AIConfigModel.deleteMany({ guildId });
  },
};
