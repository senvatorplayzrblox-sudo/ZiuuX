/**
 * Allow-list of models the owner can select in /botsettings.
 * NOTE: model names change over time and could not be verified offline when this file was written.
 * Check them against the providers' current docs before deploying and edit this list as needed.
 */
export const AI_PROVIDER_IDS = ['gemini', 'openai'] as const;
export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

export const AI_MODELS: Record<AIProviderId, { default: string; allowed: readonly string[]; label: string }> = {
  gemini: {
    label: 'Google Gemini',
    default: 'gemini-2.5-flash',
    allowed: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
  },
  openai: {
    label: 'OpenAI',
    default: 'gpt-4o-mini',
    allowed: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  },
};

export function isProviderId(v: unknown): v is AIProviderId {
  return typeof v === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(v);
}

export function isAllowedModel(provider: AIProviderId, model: string): boolean {
  return AI_MODELS[provider].allowed.includes(model);
}
