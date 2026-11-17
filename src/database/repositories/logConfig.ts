import { LogConfigModel, type LogConfigDoc } from '../models/index.js';
import type { LogCategory } from '../../config/logCategories.js';

export const LogConfigRepo = {
  async get(guildId: string): Promise<LogConfigDoc | null> {
    return LogConfigModel.findOne({ guildId }).lean<LogConfigDoc>().exec();
  },
  async setCategory(guildId: string, category: LogCategory, value: { channelId: string | null; enabled: boolean }): Promise<void> {
    await LogConfigModel.updateOne({ guildId }, { $set: { [`channels.${category}`]: value } }, { upsert: true, setDefaultsOnInsert: false });
  },
  async setMany(guildId: string, categories: readonly LogCategory[], value: { channelId: string | null; enabled: boolean }): Promise<void> {
    const $set = Object.fromEntries(categories.map((c) => [`channels.${c}`, value]));
    await LogConfigModel.updateOne({ guildId }, { $set }, { upsert: true, setDefaultsOnInsert: false });
  },
  async deleteGuildData(guildId: string): Promise<void> {
    await LogConfigModel.deleteMany({ guildId });
  },
};
