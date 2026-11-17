import { AI_MODELS, isAllowedModel, isProviderId, type AIProviderId } from '../config/aiModels.js';
import { BotSettingsRepo } from '../database/repositories/index.js';
import { BotError } from '../core/errors/BotError.js';
import type { ProviderRegistry } from '../ai/ProviderRegistry.js';
import { TtlCache } from '../utils/cache.js';
import type { AuditService } from './AuditService.js';

export interface AISelection { provider: AIProviderId; model: string }

export class BotSettingsService {
  private readonly cache = new TtlCache<AISelection>(30_000, 4);

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly audit: AuditService,
  ) {}

  /** Seeds the singleton on first boot only; an owner's later choice is never overwritten. */
  async init(seed: { provider?: AIProviderId; model?: string }): Promise<void> {
    const provider: AIProviderId = seed.provider ?? (this.registry.isConfigured('gemini') ? 'gemini' : this.registry.isConfigured('openai') ? 'openai' : 'gemini');
    const model = seed.model && isAllowedModel(provider, seed.model) ? seed.model : AI_MODELS[provider].default;
    await BotSettingsRepo.ensure({ provider, model });
  }

  async getAI(): Promise<AISelection> {
    const hit = this.cache.get('ai');
    if (hit) return hit;
    const doc = await BotSettingsRepo.get();
    let sel: AISelection = { provider: 'gemini', model: AI_MODELS.gemini.default };
    if (doc && isProviderId(doc.ai?.provider) && isAllowedModel(doc.ai.provider, String(doc.ai.model))) sel = { provider: doc.ai.provider, model: String(doc.ai.model) };
    this.cache.set('ai', sel);
    return sel;
  }

  /** Owner-only (enforced by the caller via OwnerGate). Validates against the allow-list and requires a configured key. */
  async setAI(ownerId: string, provider: string, model: string): Promise<AISelection> {
    if (!isProviderId(provider)) throw new BotError('invalid_input', 'Unknown AI provider.');
    if (!isAllowedModel(provider, model)) throw new BotError('invalid_input', `\`${model}\` is not in the allow-list for ${AI_MODELS[provider].label}.`);
    if (!this.registry.isConfigured(provider)) throw new BotError('ai_unavailable', `${AI_MODELS[provider].label} has no API key configured in the environment, so it cannot be selected.`);
    const before = await this.getAI();
    await BotSettingsRepo.setAI({ provider, model }, ownerId);
    this.cache.delete('ai');
    await this.audit.recordSettingsChange(ownerId, 'AI provider/model changed', before, { provider, model });
    return { provider, model };
  }

  setCommandsHash(hash: string): Promise<void> {
    return BotSettingsRepo.setCommandsHash(hash);
  }
  async getCommandsHash(): Promise<string | null> {
    return (await BotSettingsRepo.get())?.commandsHash ?? null;
  }
}
