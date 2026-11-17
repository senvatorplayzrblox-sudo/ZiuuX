import { z } from 'zod';
import { AI_CATEGORIES, type AICategory } from '../config/aiCategories.js';

const scoreShape = Object.fromEntries(AI_CATEGORIES.map((c) => [c, z.number().min(0).max(1)])) as Record<AICategory, z.ZodNumber>;

/** What the model must return. Out-of-range or missing values are a FAILURE, never silently repaired. */
export const classificationSchema = z.object({
  scores: z.object(scoreShape),
  confidence: z.number().min(0).max(1),
});
export type RawClassification = z.infer<typeof classificationSchema>;

const scoreProps = () => Object.fromEntries(AI_CATEGORIES.map((c) => [c, { type: 'number' }]));

/** JSON schema for OpenAI structured outputs (strict mode). */
export function openAiJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['scores', 'confidence'],
    properties: {
      scores: { type: 'object', additionalProperties: false, required: [...AI_CATEGORIES], properties: scoreProps() },
      confidence: { type: 'number' },
    },
  };
}

/** Response schema for Gemini (OpenAPI-subset, upper-case type names). */
export function geminiResponseSchema() {
  return {
    type: 'OBJECT',
    required: ['scores', 'confidence'],
    properties: {
      scores: {
        type: 'OBJECT',
        required: [...AI_CATEGORIES],
        properties: Object.fromEntries(AI_CATEGORIES.map((c) => [c, { type: 'NUMBER' }])),
      },
      confidence: { type: 'NUMBER' },
    },
  };
}
