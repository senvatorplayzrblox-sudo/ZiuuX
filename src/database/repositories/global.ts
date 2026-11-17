import { AIProviderHealthModel, BotSettingsModel, OwnerAuditModel, type AIProviderHealthDoc, type BotSettingsDoc, type OwnerAuditDoc } from '../models/index.js';

const ID = 'global';

/** Global (non-guild) data: the one deliberate exception to per-guild isolation. */
export const BotSettingsRepo = {
  async get(): Promise<BotSettingsDoc | null> {
    return BotSettingsModel.findById(ID).lean<BotSettingsDoc>().exec();
  },
  /** Creates the singleton once; never overwrites an existing owner choice. */
  async ensure(defaults: { provider: string; model: string }): Promise<BotSettingsDoc> {
    const doc = await BotSettingsModel.findOneAndUpdate(
      { _id: ID },
      { $setOnInsert: { ai: defaults, commandsHash: null, updatedBy: null, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: false },
    ).lean<BotSettingsDoc>();
    return doc as BotSettingsDoc;
  },
  async setAI(ai: { provider: string; model: string }, updatedBy: string): Promise<void> {
    await BotSettingsModel.updateOne({ _id: ID }, { $set: { ai, updatedBy, updatedAt: new Date() } });
  },
  async setCommandsHash(hash: string): Promise<void> {
    await BotSettingsModel.updateOne({ _id: ID }, { $set: { commandsHash: hash } });
  },
};

export const OwnerAuditRepo = {
  async create(data: Omit<OwnerAuditDoc, 'createdAt'>): Promise<void> {
    await OwnerAuditModel.create(data);
  },
  listRecent(kind: OwnerAuditDoc['kind'], limit: number): Promise<OwnerAuditDoc[]> {
    return OwnerAuditModel.find({ kind }).sort({ createdAt: -1 }).limit(limit).lean<OwnerAuditDoc[]>().exec();
  },
};

export const AIProviderHealthRepo = {
  async upsert(doc: Omit<AIProviderHealthDoc, 'updatedAt'>): Promise<void> {
    await AIProviderHealthModel.updateOne({ provider: doc.provider }, { $set: { ...doc, updatedAt: new Date() } }, { upsert: true, setDefaultsOnInsert: false });
  },
  list(): Promise<AIProviderHealthDoc[]> {
    return AIProviderHealthModel.find({}).lean<AIProviderHealthDoc[]>().exec();
  },
};
