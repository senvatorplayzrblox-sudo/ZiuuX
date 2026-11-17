import { AIIncidentModel, type AIIncidentDoc } from '../models/index.js';

export const AIIncidentRepo = {
  async create(guildId: string, data: Omit<AIIncidentDoc, 'guildId' | 'createdAt'>): Promise<void> {
    await AIIncidentModel.create({ ...data, guildId });
  },
  listRecent(guildId: string, skip: number, limit: number): Promise<AIIncidentDoc[]> {
    return AIIncidentModel.find({ guildId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<AIIncidentDoc[]>().exec();
  },
  count(guildId: string, since?: Date): Promise<number> {
    return AIIncidentModel.countDocuments(since ? { guildId, createdAt: { $gte: since } } : { guildId });
  },
  async deleteGuildData(guildId: string): Promise<void> {
    await AIIncidentModel.deleteMany({ guildId });
  },
};
