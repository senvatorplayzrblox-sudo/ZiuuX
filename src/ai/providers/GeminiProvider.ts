import type { AIProvider, FetchLike } from '../AIProvider.js';
import type { ClassificationResult, ClassifyInput } from '../types.js';
import { parseModelJson } from '../normalize.js';
import { geminiResponseSchema } from '../schema.js';
import { SYSTEM_PROMPT, buildUserPayload } from '../prompts/classification.js';
import { postJson } from './http.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// We are CLASSIFYING harmful text, so Gemini's own safety blocking must not swallow the request.
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map(
  (category) => ({ category, threshold: 'BLOCK_NONE' }),
);

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;

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
      `${BASE}/${encodeURIComponent(input.model)}:generateContent`,
      { 'x-goog-api-key': this.apiKey }, // header, never the URL, so keys can't leak via logged URLs
      {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildUserPayload(input.text) }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: geminiResponseSchema() },
        safetySettings: SAFETY,
      },
      input.timeoutMs,
    );
    if (!res.ok) return { ok: false, provider: this.id, reason: res.reason, detail: res.detail };

    const body = res.json as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>; promptFeedback?: { blockReason?: string } };
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' && body?.promptFeedback?.blockReason) {
      return { ok: false, provider: this.id, reason: 'invalid_output', detail: `blocked by provider: ${body.promptFeedback.blockReason}` };
    }
    const parsed = parseModelJson(text);
    if (!parsed.ok) return { ok: false, provider: this.id, reason: 'invalid_output', detail: parsed.detail };
    return { ok: true, provider: this.id, model: input.model, scores: parsed.value.scores, confidence: parsed.value.confidence, latencyMs: Date.now() - started };
  }
}
