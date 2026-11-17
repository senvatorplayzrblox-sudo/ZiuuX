import type { AIProvider, FetchLike } from '../AIProvider.js';
import type { ClassificationResult, ClassifyInput } from '../types.js';
import { parseModelJson } from '../normalize.js';
import { openAiJsonSchema } from '../schema.js';
import { SYSTEM_PROMPT, buildUserPayload } from '../prompts/classification.js';
import { postJson } from './http.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i),
  ) {}

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async classify(input: ClassifyInput): Promise<ClassificationResult> {
    if (!this.apiKey) return { ok: false, provider: this.id, reason: 'not_configured' };
    const started = Date.now();
    const res = await postJson(
      this.fetchImpl,
      ENDPOINT,
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: input.model,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPayload(input.text) },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'moderation_classification', strict: true, schema: openAiJsonSchema() } },
      },
      input.timeoutMs,
    );
    if (!res.ok) return { ok: false, provider: this.id, reason: res.reason, detail: res.detail };

    const choice = (res.json as { choices?: Array<{ message?: { content?: unknown; refusal?: unknown } }> })?.choices?.[0];
    const parsed = parseModelJson(choice?.message?.content);
    if (!parsed.ok) return { ok: false, provider: this.id, reason: 'invalid_output', detail: parsed.detail };
    return { ok: true, provider: this.id, model: input.model, scores: parsed.value.scores, confidence: parsed.value.confidence, latencyMs: Date.now() - started };
  }
}
