import { Schema, model, type Model } from 'mongoose';
import { CASE_SOURCES, CASE_TYPES, type CaseDoc, type WarningDoc } from '../../types/moderation.js';
import { RETENTION } from '../../config/constants.js';

const DAY = 24 * 60 * 60;
const idx = { timestamps: { createdAt: true, updatedAt: false }, minimize: false } as const;

// ---------- GuildSettings ----------
export interface GuildSettingsDoc { guildId: string; active: boolean; joinedAt: Date; leftAt?: Date | null; caseCounter: number }
const guildSettings = new Schema<GuildSettingsDoc>({
  guildId: { type: String, required: true },
  active: { type: Boolean, default: true },
  joinedAt: { type: Date, default: () => new Date() },
  leftAt: { type: Date, default: null },
  caseCounter: { type: Number, default: 0 },
}, { minimize: false });
guildSettings.index({ guildId: 1 }, { unique: true });
guildSettings.index({ active: 1, leftAt: 1 });
export const GuildSettingsModel: Model<GuildSettingsDoc> = model<GuildSettingsDoc>('GuildSettings', guildSettings);

// ---------- StaffPanelConfig ----------
export interface StaffPanelConfigDoc { guildId: string; staffRoleIds: string[] }
const staffPanel = new Schema<StaffPanelConfigDoc>({ guildId: { type: String, required: true }, staffRoleIds: { type: [String] } }, { minimize: false });
staffPanel.index({ guildId: 1 }, { unique: true });
export const StaffPanelConfigModel: Model<StaffPanelConfigDoc> = model<StaffPanelConfigDoc>('StaffPanelConfig', staffPanel);

// ---------- Case ----------
const caseSchema = new Schema<CaseDoc>({
  guildId: { type: String, required: true },
  caseNumber: { type: Number, required: true },
  type: { type: String, enum: CASE_TYPES, required: true },
  targetId: { type: String, default: null },
  moderatorId: { type: String, required: true },
  reason: { type: String, default: null, maxlength: 512 },
  source: { type: String, enum: CASE_SOURCES, default: 'manual' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  dmDelivered: { type: Boolean, default: null },
}, idx);
caseSchema.index({ guildId: 1, caseNumber: 1 }, { unique: true });
caseSchema.index({ guildId: 1, targetId: 1, createdAt: -1 });
caseSchema.index({ guildId: 1, moderatorId: 1, createdAt: -1 });
caseSchema.index({ guildId: 1, type: 1, createdAt: -1 });
export const CaseModel: Model<CaseDoc> = model<CaseDoc>('Case', caseSchema);

// ---------- Warning ----------
const warningSchema = new Schema<WarningDoc>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  caseNumber: { type: Number, required: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, default: null, maxlength: 512 },
  active: { type: Boolean, default: true },
  removedAt: { type: Date, default: null },
  removedBy: { type: String, default: null },
}, idx);
warningSchema.index({ guildId: 1, caseNumber: 1 }, { unique: true });
warningSchema.index({ guildId: 1, userId: 1, active: 1, createdAt: -1 });
export const WarningModel: Model<WarningDoc> = model<WarningDoc>('Warning', warningSchema);

// ---------- ChannelLock ----------
export interface ChannelLockDoc {
  guildId: string; channelId: string;
  previous: { sendMessages: boolean | null; sendMessagesInThreads: boolean | null };
  lockedBy: string; caseNumber: number | null; createdAt: Date;
}
const channelLock = new Schema<ChannelLockDoc>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  previous: { type: Schema.Types.Mixed, required: true },
  lockedBy: { type: String, required: true },
  caseNumber: { type: Number, default: null },
}, idx);
channelLock.index({ guildId: 1, channelId: 1 }, { unique: true });
export const ChannelLockModel: Model<ChannelLockDoc> = model<ChannelLockDoc>('ChannelLock', channelLock);

// ---------- LogConfig ----------
export interface LogConfigDoc { guildId: string; channels: Record<string, { channelId: string | null; enabled: boolean } | undefined> }
const logConfig = new Schema<LogConfigDoc>({ guildId: { type: String, required: true }, channels: { type: Schema.Types.Mixed } }, { minimize: false });
logConfig.index({ guildId: 1 }, { unique: true });
export const LogConfigModel: Model<LogConfigDoc> = model<LogConfigDoc>('LogConfig', logConfig);

// ---------- CommandConfig ----------
export interface CommandConfigDoc { guildId: string; commandKey: string; enabled: boolean; roleIds: string[]; channelIds: string[]; updatedBy?: string | null }
const commandConfig = new Schema<CommandConfigDoc>({
  guildId: { type: String, required: true },
  commandKey: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  roleIds: { type: [String] },
  channelIds: { type: [String] },
  updatedBy: { type: String, default: null },
}, { minimize: false });
commandConfig.index({ guildId: 1, commandKey: 1 }, { unique: true });
export const CommandConfigModel: Model<CommandConfigDoc> = model<CommandConfigDoc>('CommandConfig', commandConfig);

// ---------- AIConfig (deliberately NO schema defaults: normalizeAIConfig() fills them, which keeps $set updates conflict-free) ----------
export interface AIConfigDoc { guildId: string; [key: string]: unknown }
const aiConfig = new Schema<AIConfigDoc>({
  guildId: { type: String, required: true },
  enabled: Boolean,
  sensitivity: String,
  categories: Schema.Types.Mixed,
  blockedWordAction: String,
  timeoutSeconds: Number,
  deleteOnPunish: Boolean,
  alertChannelId: String,
  logChannelId: String,
  scopeChannelIds: [String],
  exemptRoleIds: [String],
  exemptChannelIds: [String],
  exemptUserIds: [String],
}, { minimize: false });
aiConfig.index({ guildId: 1 }, { unique: true });
export const AIConfigModel: Model<AIConfigDoc> = model<AIConfigDoc>('AIConfig', aiConfig);

// ---------- BlockedWord ----------
export interface BlockedWordDoc { guildId: string; term: string; normalized: string; matchMode: 'word' | 'contains'; addedBy: string; createdAt: Date }
const blockedWord = new Schema<BlockedWordDoc>({
  guildId: { type: String, required: true },
  term: { type: String, required: true, maxlength: 64 },
  normalized: { type: String, required: true, maxlength: 128 },
  matchMode: { type: String, enum: ['word', 'contains'], default: 'word' },
  addedBy: { type: String, required: true },
}, idx);
blockedWord.index({ guildId: 1, normalized: 1 }, { unique: true });
export const BlockedWordModel: Model<BlockedWordDoc> = model<BlockedWordDoc>('BlockedWord', blockedWord);

// ---------- AIIncident (TTL) ----------
export interface AIIncidentDoc {
  guildId: string; userId: string; channelId: string; messageId: string;
  source: 'ai' | 'blocked_word'; provider: string | null; model: string | null;
  scores: Record<string, number> | null; confidence: number | null;
  category: string; score: number | null; configuredAction: string; actionTaken: string; actionResult: string;
  excerpt: string; caseNumber: number | null; createdAt: Date;
}
const aiIncident = new Schema<AIIncidentDoc>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  source: { type: String, enum: ['ai', 'blocked_word'], required: true },
  provider: { type: String, default: null },
  model: { type: String, default: null },
  scores: { type: Schema.Types.Mixed, default: null },
  confidence: { type: Number, default: null },
  category: { type: String, required: true },
  score: { type: Number, default: null },
  configuredAction: { type: String, required: true },
  actionTaken: { type: String, required: true },
  actionResult: { type: String, required: true },
  excerpt: { type: String, default: '', maxlength: 400 },
  caseNumber: { type: Number, default: null },
}, idx);
aiIncident.index({ guildId: 1, createdAt: -1 });
aiIncident.index({ guildId: 1, userId: 1, createdAt: -1 });
aiIncident.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION.aiIncidentDays * DAY });
export const AIIncidentModel: Model<AIIncidentDoc> = model<AIIncidentDoc>('AIIncident', aiIncident);

// ---------- AIProviderHealth (global) ----------
export interface AIProviderHealthDoc {
  provider: string; state: string; consecutiveFailures: number; lastError: string | null;
  lastSuccessAt: Date | null; lastFailureAt: Date | null; successes: number; failures: number; updatedAt: Date;
}
const providerHealth = new Schema<AIProviderHealthDoc>({
  provider: { type: String, required: true },
  state: String,
  consecutiveFailures: Number,
  lastError: { type: String, default: null },
  lastSuccessAt: { type: Date, default: null },
  lastFailureAt: { type: Date, default: null },
  successes: { type: Number, default: 0 },
  failures: { type: Number, default: 0 },
  updatedAt: Date,
}, { minimize: false });
providerHealth.index({ provider: 1 }, { unique: true });
export const AIProviderHealthModel: Model<AIProviderHealthDoc> = model<AIProviderHealthDoc>('AIProviderHealth', providerHealth);

// ---------- BotSettings (global singleton, _id "global") ----------
export interface BotSettingsDoc { _id: string; ai: { provider: string; model: string }; commandsHash: string | null; updatedBy: string | null; updatedAt: Date }
const botSettings = new Schema<BotSettingsDoc>({
  _id: { type: String },
  ai: { type: Schema.Types.Mixed, required: true },
  commandsHash: { type: String, default: null },
  updatedBy: { type: String, default: null },
  updatedAt: { type: Date, default: () => new Date() },
}, { minimize: false });
export const BotSettingsModel: Model<BotSettingsDoc> = model<BotSettingsDoc>('BotSettings', botSettings);

// ---------- OwnerAudit (global, TTL) ----------
export interface OwnerAuditDoc { userId: string; guildId: string | null; kind: 'settings_change' | 'panel_bypass'; detail: string; before: unknown; after: unknown; createdAt: Date }
const ownerAudit = new Schema<OwnerAuditDoc>({
  userId: { type: String, required: true },
  guildId: { type: String, default: null },
  kind: { type: String, enum: ['settings_change', 'panel_bypass'], required: true },
  detail: { type: String, default: '' },
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
}, idx);
ownerAudit.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION.ownerAuditDays * DAY });
ownerAudit.index({ kind: 1, createdAt: -1 });
export const OwnerAuditModel: Model<OwnerAuditDoc> = model<OwnerAuditDoc>('OwnerAudit', ownerAudit);

export const ALL_MODELS: Array<Model<any>> = [
  GuildSettingsModel, StaffPanelConfigModel, CaseModel, WarningModel, ChannelLockModel, LogConfigModel, CommandConfigModel,
  AIConfigModel, BlockedWordModel, AIIncidentModel, AIProviderHealthModel, BotSettingsModel, OwnerAuditModel,
];
