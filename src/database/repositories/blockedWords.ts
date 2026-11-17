import { BlockedWordModel, type BlockedWordDoc } from '../models/index.js';

export const BlockedWordRepo = {
  list(guildId: string): Promise<BlockedWordDoc[]> {
    return BlockedWordModel.find({ guildId }).sort({ normalized: 1 }).lean<BlockedWordDoc[]>().exec();
  },
  count(guildId: string): Promise<number> {
    return BlockedWordModel.countDocuments({ guildId });
  },
  /** true = inserted, false = duplicate. */
  async add(guildId: string, data: Pick<BlockedWordDoc, 'term' | 'normalized' | 'matchMode' | 'addedBy'>): Promise<boolean> {
    const r = await BlockedWordModel.updateOne({ guildId, normalized: data.normalized }, { $setOnInsert: { ...data, guildId } }, { upsert: true, setDefaultsOnInsert: true });
    return r.upsertedCount > 0;
  },
  async remove(guildId: string, normalized: string): Promise<boolean> {
    const r = await BlockedWordModel.deleteOne({ guildId, normalized });
    return r.deletedCount > 0;
  },
  async deleteGuildData(guildId: string): Promise<void> {
    await BlockedWordModel.deleteMany({ guildId });
  },
};
