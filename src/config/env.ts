import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const snowflake = z.string().regex(/^\d{17,20}$/, 'must be a Discord snowflake (17-20 digits)');
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());

const schema = z.object({
  DISCORD_TOKEN: z.string().trim().min(20, 'looks too short'),
  CLIENT_ID: snowflake,
  MONGODB_URI: z.string().trim().regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  BOT_OWNER_ID: snowflake,
  GEMINI_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  GUILD_ID: z.preprocess(emptyToUndefined, snowflake.optional()),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  AI_DEFAULT_PROVIDER: z.preprocess(emptyToUndefined, z.enum(['gemini', 'openai']).optional()),
  AI_DEFAULT_MODEL: optionalString,
});

export type Env = z.infer<typeof schema>;

/** Pure and testable. Throws one readable error listing every problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}

let cached: Env | undefined;
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Values that must never appear in logs or error messages. */
export function secretValues(env: Env): string[] {
  return [env.DISCORD_TOKEN, env.MONGODB_URI, env.GEMINI_API_KEY, env.OPENAI_API_KEY].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
}
