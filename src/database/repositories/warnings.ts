import type { ClientSession } from 'mongoose';
import { WarningModel } from '../models/index.js';
import type { WarningDoc } from '../../types/moderation.js';

export const WarningRepo = {
  async create(guildId: string, data: Omit<WarningDoc, 'createdAt' | 'active' | 'removedAt' | 'removedBy'>, session?: ClientSession): Promise<void> {
    await WarningModel.create([{ ...data, guildId, active: true }], { session });
  },

  listForUser(guildId: string, userId: string, opts: { activeOnly?: boolean; limit: number }): Promise<WarningDoc[]> {
    const filter: Record<string, unknown> = { guildId, userId };
    if (opts.activeOnly) filter.active = true;
    return WarningModel.find(filter).sort({ createdAt: -1 }).limit(opts.limit).lean<WarningDoc[]>().exec();
  },

  countActive(guildId: string, userId: string): Promise<number> {
    return WarningModel.countDocuments({ guildId, userId, active: true });
  },

  countActiveAll(guildId: string): Promise<number> {
    return WarningModel.countDocuments({ guildId, active: true });
  },

  findByCase(guildId: string, caseNumber: number): Promise<WarningDoc | null> {
    return WarningModel.findOne({ guildId, caseNumber }).lean<WarningDoc>().exec();
  },

  /** Returns the updated doc, or null if the warning does not exist / is already inactive in THIS guild. */
  async deactivate(guildId: string, caseNumber: number, removedBy: string, session?: ClientSession): Promise<WarningDoc | null> {
    return WarningModel.findOneAndUpdate(
      { guildId, caseNumber, active: true },
      { $set: { active: false, removedAt: new Date(), removedBy } },
      { new: true, session },
    ).lean<WarningDoc>().exec();
  },

  async deactivateAllForUser(guildId: string, userId: string, removedBy: string, session?: ClientSession): Promise<number> {
    const r = await WarningModel.updateMany({ guildId, userId, active: true }, { $set: { active: false, removedAt: new Date(), removedBy } }, { session });
    return r.modifiedCount;
  },

  async deleteGuildData(guildId: string): Promise<void> {
    await WarningModel.deleteMany({ guildId });
  },
};
