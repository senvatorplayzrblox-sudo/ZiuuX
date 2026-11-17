import { getEnv } from '../config/env.js';
import { AIClassifier } from '../ai/AIClassifier.js';
import { ProviderRegistry } from '../ai/ProviderRegistry.js';
import { GeminiProvider } from '../ai/providers/GeminiProvider.js';
import { OpenAIProvider } from '../ai/providers/OpenAIProvider.js';
import { OwnerGate } from '../permissions/OwnerGate.js';
import { PermissionService } from '../permissions/PermissionService.js';
import type { Services } from '../types/services.js';
import { ActionMarkers } from '../services/ActionMarkers.js';
import { AIConfigService } from '../services/AIConfigService.js';
import { AIModerationService } from '../services/AIModerationService.js';
import { AuditService } from '../services/AuditService.js';
import { BlockedWordService } from '../services/BlockedWordService.js';
import { BotSettingsService } from '../services/BotSettingsService.js';
import { CaseService } from '../services/CaseService.js';
import { CommandConfigService } from '../services/CommandConfigService.js';
import { GuildSettingsService } from '../services/GuildSettingsService.js';
import { HealthService } from '../services/HealthService.js';
import { LockService } from '../services/LockService.js';
import { LoggingService } from '../services/LoggingService.js';
import { ModerationService } from '../services/ModerationService.js';
import { RetentionService } from '../services/RetentionService.js';
import { StaffPanelService } from '../services/StaffPanelService.js';
import { WarningService } from '../services/WarningService.js';

/** Composition root: the only place services are wired together. To add an AI provider, register it here. */
export function createServices(): Services {
  const env = getEnv();
  const providers = new ProviderRegistry().register(new GeminiProvider(env.GEMINI_API_KEY)).register(new OpenAIProvider(env.OPENAI_API_KEY));
  const classifier = new AIClassifier(providers);
  const audit = new AuditService();
  const ownerGate = OwnerGate.fromEnv(audit);
  const permissions = new PermissionService();
  const markers = new ActionMarkers();
  const cases = new CaseService();
  const warnings = new WarningService(cases);
  const locks = new LockService();
  const logging = new LoggingService();
  const moderation = new ModerationService(permissions, cases, warnings, locks, logging, markers);
  const botSettings = new BotSettingsService(providers, audit);
  const aiConfig = new AIConfigService();
  const blockedWords = new BlockedWordService();
  const aiModeration = new AIModerationService(aiConfig, blockedWords, botSettings, classifier, moderation, logging, markers);
  return {
    providers, classifier, permissions, ownerGate, markers, audit, guildSettings: new GuildSettingsService(), commandConfig: new CommandConfigService(),
    cases, warnings, locks, logging, moderation, staffPanel: new StaffPanelService(), botSettings, aiConfig, blockedWords, aiModeration,
    health: new HealthService(classifier), retention: new RetentionService(),
  };
}
