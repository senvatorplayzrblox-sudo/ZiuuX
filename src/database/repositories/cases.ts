import type { ClientSession } from 'mongoose';
import { CaseModel } from '../models/index.js';
import type { CaseDoc, CaseType } from '../../types/moderation.js';

export type NewCase = Omit<CaseDoc, 'createdAt'>;

export const CaseRepo = {
  async create(guildId: string, data: NewCase, session?: ClientSession): Promise<CaseDoc> {
    const [doc] = await CaseModel.create([{ ...data, guildId }], { session });
    return (doc as unknown as { toObject(): CaseDoc }).toObject();
  },

  find(guildId: string, caseNumber: number): Promise<CaseDoc | null> {
    return CaseModel.findOne({ guildId, caseNumber }).lean<CaseDoc>().exec();
  },

  listByTarget(guildId: string, targetId: string, limit: number): Promise<CaseDoc[]> {
    return CaseModel.find({ guildId, targetId }).sort({ createdAt: -1 }).limit(limit).lean<CaseDoc[]>().exec();
  },

  async countByTarget(guildId: string, targetId: string): Promise<number> {
    return CaseModel.countDocuments({ guildId, targetId });
  },

  listRecent(guildId: string, opts: { type?: CaseType; skip?: number; limit: number }): Promise<CaseDoc[]> {
    const filter: Record<string, unknown> = { guildId };
    if (opts.type) filter.type = opts.type;
    return CaseModel.find(filter).sort({ caseNumber: -1 }).skip(opts.skip ?? 0).limit(opts.limit).lean<CaseDoc[]>().exec();
  },

  count(guildId: string, opts: { type?: CaseType; since?: Date } = {}): Promise<number> {
    const filter: Record<string, unknown> = { guildId };
    if (opts.type) filter.type = opts.type;
    if (opts.since) filter.createdAt = { $gte: opts.since };
    return CaseModel.countDocuments(filter);
  },

  async deleteGuildData(guildId: string): Promise<void> {
    await CaseModel.deleteMany({ guildId });
  },
};
