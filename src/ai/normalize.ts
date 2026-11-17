import { classificationSchema, type RawClassification } from './schema.js';

export type ParsedModelOutput = { ok: true; value: RawClassification } | { ok: false; detail: string };

/** Strips optional ```json fences, parses JSON and validates with zod. */
export function parseModelJson(raw: unknown): ParsedModelOutput {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, detail: 'empty model output' };
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return { ok: false, detail: 'model output is not valid JSON' };
  }
  const parsed = classificationSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, detail: `schema mismatch at ${first?.path.join('.') ?? '?'}: ${first?.message ?? 'invalid'}` };
  }
  return { ok: true, value: parsed.data };
}
