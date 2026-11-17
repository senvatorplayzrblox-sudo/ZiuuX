import { CommandConfigModel, type CommandConfigDoc } from '../models/index.js';

export const CommandConfigRepo = {
  list(guildId: string): Promise<CommandConfigDoc[]> {
    return CommandConfigModel.find({ guildId }).lean<CommandConfigDoc[]>().exec();
  },
  async patch(guildId: string, commandKey: string, patch: Partial<Pick<CommandConfigDoc, 'enabled' | 'roleIds' | 'channelIds'>>, updatedBy: string): Promise<void> {
    await CommandConfigModel.updateOne({ guildId, commandKey }, { $set: { ...patch, updatedBy } }, { upsert: true, setDefaultsOnInsert: true });
  },
  async delete(guildId: string, commandKey: string): Promise<void> {
    await CommandConfigModel.deleteOne({ guildId, commandKey });
  },
  async deleteGuildData(guildId: string): Promise<void> {
    await CommandConfigModel.deleteMany({ guildId });
  },
};
