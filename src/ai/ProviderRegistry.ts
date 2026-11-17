import type { AIProviderId } from '../config/aiModels.js';
import type { AIProvider } from './AIProvider.js';

/** Adding a provider = one adapter file + one register() call in bootstrap. */
export class ProviderRegistry {
  private readonly providers = new Map<AIProviderId, AIProvider>();

  register(provider: AIProvider): this {
    this.providers.set(provider.id, provider);
    return this;
  }

  /** Returns the adapter only if it exists AND has a key. */
  get(id: AIProviderId): AIProvider | undefined {
    const p = this.providers.get(id);
    return p && p.isConfigured() ? p : undefined;
  }

  has(id: AIProviderId): boolean {
    return this.providers.has(id);
  }

  isConfigured(id: AIProviderId): boolean {
    return this.providers.get(id)?.isConfigured() ?? false;
  }

  ids(): AIProviderId[] {
    return [...this.providers.keys()];
  }
}
