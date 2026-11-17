import type { ClientSession } from 'mongoose';
import { GuildSettingsModel, type GuildSettingsDoc } from '../models/index.js';

export const GuildSettingsRepo = {
  async ensure(guildId: string): Promise<GuildSettingsDoc> {
    const doc = await GuildSettingsModel.findOneAndUpdate(
      { guildId },
      { $set: { active: true }, $unset: { leftAt: '' }, $setOnInsert: { joinedAt: new Date(), caseCounter: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: false },
    ).lean<GuildSettingsDoc>();
    return doc as GuildSettingsDoc;
  },

  /** Atomic per-guild case number allocation. Call inside the same transaction as the Case insert. */
  async nextCaseNumber(guildId: string, session?: ClientSession): Promise<number> {
    const doc = await GuildSettingsModel.findOneAndUpdate(
      { guildId },
      { $inc: { caseCounter: 1 }, $setOnInsert: { joinedAt: new Date(), active: true } },
      { upsert: true, new: true, setDefaultsOnInsert: false, session },
    ).lean<GuildSettingsDoc>();
    return (doc as GuildSettingsDoc).caseCounter;
  },

  async markInactive(guildId: string): Promise<void> {
    await GuildSettingsModel.updateOne({ guildId }, { $set: { active: false, leftAt: new Date() } });
  },

  /** Single-process only: marks guilds the client no longer sees as inactive. Never called when sharded. */
  async markMissingInactive(presentGuildIds: string[]): Promise<number> {
    if (presentGuildIds.length === 0) return 0;
    const r = await GuildSettingsModel.updateMany(
      { active: true, guildId: { $nin: presentGuildIds } },
      { $set: { active: false, leftAt: new Date() } },
    );
    return r.modifiedCount;
  },

  async findExpired(before: Date): Promise<string[]> {
    const docs = await GuildSettingsModel.find({ active: false, leftAt: { $lt: before } }).select('guildId').lean<Array<{ guildId: string }>>();
    return docs.map((d) => d.guildId);
  },

  async deleteGuildData(guildId: string): Promise<void> {
    await GuildSettingsModel.deleteOne({ guildId });
  },

  async counts(): Promise<{ active: number; inactive: number }> {
    const [active, inactive] = await Promise.all([
      GuildSettingsModel.countDocuments({ active: true }),
      GuildSettingsModel.countDocuments({ active: false }),
    ]);
    return { active, inactive };
  },
};
