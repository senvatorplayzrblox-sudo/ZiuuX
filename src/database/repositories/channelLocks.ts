import { ChannelLockModel, type ChannelLockDoc } from '../models/index.js';

export const ChannelLockRepo = {
  find(guildId: string, channelId: string): Promise<ChannelLockDoc | null> {
    return ChannelLockModel.findOne({ guildId, channelId }).lean<ChannelLockDoc>().exec();
  },
  async upsert(guildId: string, data: Omit<ChannelLockDoc, 'guildId' | 'createdAt'>): Promise<void> {
    await ChannelLockModel.updateOne({ guildId, channelId: data.channelId }, { $set: { ...data, guildId } }, { upsert: true });
  },
  async delete(guildId: string, channelId: string): Promise<void> {
    await ChannelLockModel.deleteOne({ guildId, channelId });
  },
  async deleteGuildData(guildId: string): Promise<void> {
    await ChannelLockModel.deleteMany({ guildId });
  },
};
